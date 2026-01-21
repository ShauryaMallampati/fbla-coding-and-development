const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// db setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ai stuff (gemini checks if posts are mid or not)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

// serve the homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

// admin dashboard
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "admin.html"));
});

// get all items with optional filters
app.get("/api/items", async (req, res) => {
  try {
    const { q, status, category } = req.query;
    let query = supabase.from("items").select("*").order("created_at", { ascending: false });

    if (q) {
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// create new item (no file upload for serverless)
app.post("/api/items", async (req, res) => {
  try {
    const { name, description, category, location, date_found, photo_url } = req.body;

    const itemData = {
      title: name,
      description: description || "",
      category: category || "Other",
      location_found: location,
      date_found: date_found,
      status: "unclaimed",
      photo_url: photo_url || null
    };

    const { data, error } = await supabase.from("items").insert([itemData]).select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// update item status
app.put("/api/items/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabase
      .from("items")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// delete item
app.delete("/api/items/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("items").delete().eq("id", id);

    if (error) throw error;
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get all claims
app.get("/api/claims", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("claims")
      .select("*, items(*)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// create claim
app.post("/api/claims", async (req, res) => {
  try {
    const { item_id, claimant_name, claimant_email, description } = req.body;

    const claimData = {
      item_id,
      claimant_name: claimant_name,
      claimant_email: claimant_email,
      description: description || "",
      status: "pending"
    };

    const { data, error } = await supabase.from("claims").insert([claimData]).select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// update claim status
app.put("/api/claims/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabase
      .from("claims")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select();

    if (error) throw error;

    // if approved, mark item as claimed
    if (status === "approved") {
      const claim = data[0];
      await supabase
        .from("items")
        .update({ status: "claimed", updated_at: new Date().toISOString() })
        .eq("id", claim.item_id);
    }

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ai validation endpoint
app.post("/api/validate-item/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data: item, error } = await supabase
      .from("items")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !item) {
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

module.exports = app;
