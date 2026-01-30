const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const isPlaceholder = (value) =>
  !value || value.toLowerCase().startsWith("your_");

const existingEnv = new Set(Object.keys(process.env));
const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const parsed = dotenv.parse(fs.readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (isPlaceholder(value)) continue;
    if (existingEnv.has(key)) continue;
    process.env[key] = value;
  }
};

// load envs (local overrides without clobbering real env vars)
loadEnvFile(path.join(__dirname, ".env"));
loadEnvFile(path.join(__dirname, ".env.local"));

// db hookup (supabase)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const missingEnv = [];
if (isPlaceholder(supabaseUrl)) missingEnv.push("SUPABASE_URL");
if (isPlaceholder(supabaseKey)) {
  missingEnv.push("SUPABASE_KEY (or SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY)");
}
if (missingEnv.length > 0) {
  console.error(`Missing required env vars: ${missingEnv.join(", ")}`);
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// ai vibe check (optional)
const hasGeminiKey = !isPlaceholder(process.env.GEMINI_API_KEY);
const genAI = hasGeminiKey ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" }) : null;

const app = express();
const PORT = process.env.PORT || 3000;

// uploads stash (local)
const uploadsDir = path.join(__dirname, "uploads");
let uploadsAvailable = true;
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
} catch (err) {
  uploadsAvailable = false;
  console.warn(`Uploads disabled: ${err.message}`);
}

const storage = uploadsAvailable
  ? multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadsDir);
      },
      filename: (req, file, cb) => {
        const uniqueId = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const fileExt = path.extname(file.originalname);
        cb(null, "item-" + uniqueId + fileExt);
      }
    })
  : multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
}); // file upload handler (5MB max)

const SCHEMA_CACHE_ERROR_CODE = "PGRST205";
const getSupabaseErrorResponse = (error, fallbackMessage) => {
  if (error?.code === SCHEMA_CACHE_ERROR_CODE) {
    return {
      status: 500,
      body: {
        error: fallbackMessage,
        hint:
          "Supabase tables not found or schema cache is stale. Run npm run setup:supabase or the SQL in SUPABASE-SETUP.md, then run: NOTIFY pgrst, 'reload schema';"
      }
    };
  }

  return { status: 500, body: { error: fallbackMessage } };
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (uploadsAvailable) {
  app.use("/uploads", express.static(uploadsDir));
}
app.use(express.static(path.join(__dirname, "public")));

// serve homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// admin dashboard page
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// get items (filters + search)
app.get("/api/items", async (req, res) => {
  try {
    const { q, status, category } = req.query;
    let query = supabase.from("items").select("*");

    // admin sees everything, public sees approved/claimed only
    if (status === "all") {
      // admin view
    } else if (status) {
      query = query.eq("status", status);
    } else {
      query = query.in("status", ["approved", "claimed"]);
    }

    // category filter
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    // search across title/description/location
    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,location_found.ilike.%${q}%`);
    }

    // newest first
    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      const response = getSupabaseErrorResponse(error, "Failed to load items");
      return res.status(response.status).json(response.body);
    }

    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load items" });
  }
});

// submit a found item
app.post("/api/items", upload.single("photo"), async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      locationFound,
      dateFound,
      finderName,
      finderEmail
    } = req.body;

    // need the basics
    if (!title || !locationFound || !dateFound) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (req.file && !uploadsAvailable) {
      return res.status(503).json({ error: "Uploads are unavailable in this environment" });
    }

    const photoPath = req.file ? "/uploads/" + req.file.filename : null;

    const itemData = {
      title: title.trim(),
      category: category || "",
      description: description || "",
      location_found: locationFound.trim(),
      date_found: dateFound,
      finder_name: finderName || "",
      finder_email: finderEmail || "",
      photo_path: photoPath,
      status: "pending"
    };

    const { data, error } = await supabase
      .from("items")
      .insert([itemData])
      .select();

    if (error) {
      console.error("Supabase error:", error);
      const response = getSupabaseErrorResponse(error, "Failed to submit item");
      return res.status(response.status).json(response.body);
    }

    res.status(201).json({
      message: "Item submitted successfully and is pending review",
      id: data[0].id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit item" });
  }
});

// change item status (admin only)
app.put("/api/items/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ["pending", "approved", "claimed", "archived"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const { error } = await supabase
      .from("items")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Supabase error:", error);
      const response = getSupabaseErrorResponse(error, "Failed to update status");
      return res.status(response.status).json(response.body);
    }

    res.json({ message: "Status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// delete an item
app.delete("/api/items/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // remove associated claims first
    await supabase.from("claims").delete().eq("item_id", id);

    const { error } = await supabase.from("items").delete().eq("id", id);

    if (error) {
      console.error("Supabase error:", error);
      const response = getSupabaseErrorResponse(error, "Failed to delete item");
      return res.status(response.status).json(response.body);
    }

    res.json({ message: "Item deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// someone claims an item
app.post("/api/claims", async (req, res) => {
  try {
    const { itemId, claimantName, claimantEmail, details } = req.body;

    // need these
    if (!itemId || !claimantName || !claimantEmail) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const claimData = {
      item_id: itemId,
      claimant_name: claimantName.trim(),
      claimant_email: claimantEmail.trim(),
      details: details || "",
      status: "new"
    };

    const { data, error } = await supabase
      .from("claims")
      .insert([claimData])
      .select();

    if (error) {
      console.error("Supabase error:", error);
      const response = getSupabaseErrorResponse(error, "Failed to submit claim");
      return res.status(response.status).json(response.body);
    }

    res.status(201).json({
      message: "Claim submitted successfully",
      id: data[0].id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit claim" });
  }
});

// get all claims (admin)
app.get("/api/claims", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("claims")
      .select(`
        *,
        items (
          title
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      const response = getSupabaseErrorResponse(error, "Failed to load claims");
      return res.status(response.status).json(response.body);
    }

    // add item title to each claim for easier display
    const transformedData = data.map(claim => ({
      ...claim,
      item_title: claim.items?.title || "Unknown Item"
    }));

    res.json(transformedData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load claims" });
  }
});

// update claim status
app.put("/api/claims/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // only these statuses are valid
    const allowed = ["new", "in_review", "resolved"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const { error } = await supabase
      .from("claims")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Supabase error:", error);
      const response = getSupabaseErrorResponse(error, "Failed to update claim status");
      return res.status(response.status).json(response.body);
    }

    res.json({ message: "Claim status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update claim status" });
  }
});

// ai vibe check for submissions (gemini validation)
app.post("/api/validate-item/:id", async (req, res) => {
  try {
    if (!model) {
      return res.status(503).json({ error: "AI validation unavailable (missing GEMINI_API_KEY)" });
    }

    const { id } = req.params;

    const { data: item, error } = await supabase
      .from("items")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !item) {
      if (error) {
        console.error("Supabase error:", error);
      }
      return res.status(404).json({ error: "Item not found" });
    }

    // gemini checks for spam, gibberish, fake stuff, etc
    const prompt = `You're moderating a school lost & found system. Check if this item submission looks legit or sus.

Title: ${item.title}
Category: ${item.category}
Description: ${item.description || "N/A"}
Location: ${item.location_found}
Date: ${item.date_found}

Respond in JSON only with: isLegitimate (true/false), confidence (0-100), reasoning (short), flags (array). Look for weird stuff like gibberish, spam, fake items, or inappropriate content.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let aiText = response.text();

    // clean up the response
    aiText = aiText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const validation = JSON.parse(aiText);

    // save the validation result
    await supabase
      .from("items")
      .update({
        ai_validation: validation,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    res.json(validation);
  } catch (err) {
    console.error("AI Validation error:", err);
    res.status(500).json({
      error: "Failed to validate item",
      details: err.message
    });
  }
});

// start the server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🔍 Lost and Found running on http://localhost:${PORT}`);
  });
}

module.exports = app;
