const { OpenAI } = require("openai");

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: OPENAI_API_KEY is not defined in the environment variables!");
}

const openai = new OpenAI({
  apiKey: apiKey || "placeholder-key-to-prevent-immediate-crash",
});

module.exports = openai;
