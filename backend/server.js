const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { OpenAI } = require("openai");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.MESH_API_KEY,
  baseURL: "https://api.meshapi.ai/v1",
});

app.post("/api/simulate", async (req, res) => {
  try {
    const { question, options } = req.body;

    if (!question || !options || options.length !== 3) {
      return res.status(400).json({
        error: "Please provide exactly three options.",
      });
    }

    const isFood =
      /egg|pizza|fruit|vegetable|salad|meal|diet|nutrition|food|breakfast|lunch|dinner|protein|carb|fat/i.test(
        question
      );

    const prompt = `
You are an elite strategic decision analysis AI.

The user is comparing exactly THREE choices.

Question:
${question}

Choices:
1. ${options[0]}
2. ${options[1]}
3. ${options[2]}

IMPORTANT RULES

Return ONLY valid JSON.

Never return markdown.

Never return backticks.

Never explain yourself.

Never invent placeholder labels like:

Dimension 1

Dimension 2

Parameter Vector

Metric Alpha

Metric Beta

Score X

Category A

Everything must feel written by a domain expert.

------------------------------------------------

For EACH option generate:

title

score (0-100)

summary (2-3 sentences)

fact (interesting research-backed fact)

strengths (3 bullet points)

tradeoffs (3 bullet points)

metrics (5 dynamic metrics)

timeline (only if meaningful)

------------------------------------------------

Metrics MUST be dynamic.

Examples:

Career

Expected Salary

Learning Curve

Work-Life Balance

Risk

Growth Potential

Networking

Financial Stability

Leadership

Burnout Risk

Lifestyle

Time Freedom

Stress

Savings

Travel Flexibility

Health

Food

Protein

Fiber

Calories

Micronutrients

Satiety

Heart Health

Muscle Growth

Blood Sugar

Vitamin Density

Recovery

Technology

Battery

Camera

Performance

Longevity

Software

Repairability

Gaming

AI Features

Display

Value

DO NOT repeat metric names.

------------------------------------------------

If this comparison is NOT time-based

(food etc.)

return

timeline_relevant:false

and timeline:[]

Otherwise

timeline_relevant:true

and generate

4 timeline milestones

Example

[
{
"period":"Year 1",
"milestone":"..."
}
]

------------------------------------------------

Return EXACTLY this JSON structure

{
"verdict":{
"winner":"",
"summary":""
},
"timeline_relevant":true,
"options":[
{
"title":"",
"score":91,
"summary":"",
"fact":"",
"strengths":[
"",
"",
""
],
"tradeoffs":[
"",
"",
""
],
"metrics":[
{
"name":"",
"value":90
}
],
"timeline":[
{
"period":"",
"milestone":""
}
]
}
]
}
`;

    const completion = await client.chat.completions.create({
      model: "openai/gpt-4o-mini",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "You are an expert comparative decision engine. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    let content = completion.choices[0].message.content.trim();

    content = content
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();
          let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("JSON Parse Error");
      console.error(content);

      return res.status(500).json({
        error: "The AI returned invalid JSON.",
      });
    }

    if (
      !parsed.verdict ||
      !parsed.options ||
      !Array.isArray(parsed.options)
    ) {
      return res.status(500).json({
        error: "AI response is missing required fields.",
      });
    }

    parsed.options = parsed.options.map((option) => {
      return {
        title: option.title || "Untitled",

        score:
          typeof option.score === "number"
            ? Math.max(0, Math.min(100, option.score))
            : 50,

        summary: option.summary || "",

        fact: option.fact || "",

        strengths: Array.isArray(option.strengths)
          ? option.strengths.slice(0, 3)
          : [],

        tradeoffs: Array.isArray(option.tradeoffs)
          ? option.tradeoffs.slice(0, 3)
          : [],

        metrics: Array.isArray(option.metrics)
          ? option.metrics
              .filter(
                (m) =>
                  m &&
                  typeof m.name === "string" &&
                  typeof m.value === "number"
              )
              .slice(0, 5)
          : [],

        timeline: Array.isArray(option.timeline)
          ? option.timeline
          : [],
      };
    });

    parsed.verdict = {
      winner: parsed.verdict.winner || parsed.options[0].title,
      summary: parsed.verdict.summary || "",
    };

    parsed.timeline_relevant = Boolean(parsed.timeline_relevant);

    res.json(parsed);

  } catch (error) {

    console.error("Simulation Error:");
    console.error(error);

    res.status(500).json({
      error: error.message || "Internal Server Error",
    });
  }
  });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Life in Parallel Backend running on http://localhost:${PORT}`);
});