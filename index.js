import express from "express";
import { GoogleGenAI } from "@google/genai";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const server = new McpServer({
  name: "gemini-image-mcp",
  version: "1.0.0"
});

server.tool(
  "generate_image",
  "Generate an image using Google's Gemini model.",
  {
    prompt: z.string().describe("Description of the image to generate")
  },
  async ({ prompt }) => {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt
    });

    const parts = result.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(part => part.inlineData?.data);

    if (!imagePart) {
      throw new Error("Gemini did not return an image.");
    }

    return {
      content: [
        {
          type: "image",
          data: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType || "image/png"
        }
      ]
    };
  }
);

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on("close", () => transport.close());

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/", (req, res) => {
  res.send("Gemini Image MCP is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
