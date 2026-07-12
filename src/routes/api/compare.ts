import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type Body = {
  question?: string;
  options?: string[];
};

const SYSTEM = `You are a world-class decision consultant. When given a question comparing exactly three options, produce a rigorous, research-informed, structured comparison.

You MUST return ONLY valid JSON (no prose, no markdown fences) matching this exact shape:

{
  "verdict": {
    "winner": "<exact name of the strongest option, matching one of the provided option titles>",
    "summary": "<2-4 sentence executive summary explaining which option is strongest overall and why>"
  },
  "timeline_relevant": <true|false>,
  "options": [
    {
      "title": "<option name, matching provided input>",
      "score": <integer 0-100, differentiated across options>,
      "summary": "<2-3 sentence overview>",
      "fact": "<one interesting, specific, research-backed or widely-verified fact about this option>",
      "strengths": ["<3 to 5 concrete, meaningful strengths>"],
      "tradeoffs": ["<3 to 5 realistic, honest disadvantages>"],
      "metrics": [
        { "name": "<domain-appropriate metric name>", "value": <0-100 integer>, "note": "<short 3-8 word qualitative label>" }
      ],
      "timeline": [
        { "period": "<e.g. 'Year 1'>", "milestone": "<short description>" }
      ]
    }
  ]
}

Rules:
- Always exactly 3 options in the "options" array, in the same order as provided.
- Scores must be differentiated (not all equal). The winner should have the highest score.
- Every option must include between 5 and 8 metrics. Metric names MUST be domain-specific and meaningful (e.g. "Protein", "Salary Growth", "Battery Life", "Scalability"). NEVER use placeholders like "Metric A", "Dimension 1", "Parameter", "Factor Alpha", "Vector", "Node", "Variable".
- All three options should share MOSTLY the same metric names so they can be compared side-by-side (small variation is acceptable).
- Strengths: 3-5 items. Trade-offs: 3-5 items. Never fewer than 3.
- "timeline_relevant" is true ONLY for questions where time genuinely matters (careers, business, investments, education, fitness transformations). It is false for food, phones, restaurants, movies, simple product comparisons. When false, set each option's "timeline" to [].
- When timeline_relevant is true, include 3-5 timeline milestones per option.
- Facts must be specific and credible, never generic filler.
- Output JSON only. No commentary, no code fences.`;

export const Route = createFileRoute("/api/compare")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { question, options } = (await request.json()) as Body;
          if (!question || !Array.isArray(options) || options.length !== 3 || options.some((o) => !o?.trim())) {
            return new Response(JSON.stringify({ error: "Provide a question and exactly 3 non-empty options." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return new Response(JSON.stringify({ error: "AI is not configured." }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const gateway = createLovableAiGatewayProvider(key);
          const model = gateway("google/gemini-3-flash-preview");

          const userPrompt = `Question: ${question.trim()}

Options to compare (in this order):
1. ${options[0].trim()}
2. ${options[1].trim()}
3. ${options[2].trim()}

Return the JSON now.`;

          const runOnce = async () => {
            const res = await generateText({
              model,
              system: SYSTEM,
              prompt: userPrompt,
            });
            return res.text;
          };

          const parse = (raw: string) => {
            let t = raw.trim();
            if (t.startsWith("```")) {
              t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
            }
            const start = t.indexOf("{");
            const end = t.lastIndexOf("}");
            if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
            return JSON.parse(t);
          };

          let data: unknown;
          try {
            data = parse(await runOnce());
          } catch {
            data = parse(await runOnce());
          }

          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
