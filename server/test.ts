import { GoogleGenAI } from "@google/genai";

// Test Gemini API with Google Search
async function testGeminiAPI() {
  console.log("Starting Gemini API test with Google Search...");
  console.log("Environment variable status:");
  console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "✓ Set" : "✗ Not set"}`);
  console.log(`  AI_INTEGRATIONS_GEMINI_API_KEY: ${process.env.AI_INTEGRATIONS_GEMINI_API_KEY ? "✓ Set" : "✗ Not set"}`);

  if (!process.env.GEMINI_API_KEY && !process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
    console.error("\n❌ Error: No Gemini API key found.");
    console.log("\nTo fix this:");
    console.log("1. Get your API key from: https://aistudio.google.com/app/apikey");
    console.log("2. Set the environment variable: GEMINI_API_KEY=your-key-here");
    console.log("   Or: AI_INTEGRATIONS_GEMINI_API_KEY=your-key-here");
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

  try {
    console.log("\n✓ Initializing GoogleGenAI client...");
    const genAI = new GoogleGenAI({
      apiKey: apiKey!,
    });

    // Test 1: Bitcoin Price with Google Search enabled
    console.log("\n" + "=".repeat(60));
    console.log("TEST 1: Bitcoin Price Query (With Google Search)");
    console.log("=".repeat(60));
    console.log("📊 Query: 'What is the current Bitcoin (BTC) price right now?'\n");
    
    const result1 = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: "What is the current Bitcoin (BTC) price right now today? Tell me the exact USD price you find from web search." }],
        },
      ],
      config: {
      tools: [{ googleSearch: {} }] // This line enables web grounding
    },
      
    });

    console.log("📝 Full Response Object:");
    console.log("---");
    console.log(JSON.stringify(result1, null, 2));
    console.log("---");
    
    console.log("\n📝 Text Response:");
    console.log("---");
    console.log(result1.text);
    console.log("---");

    // Check if response contains search results
    const responseText = result1.text || "";
    const hasRealPrice = responseText.includes("$") && (
      responseText.includes("2026") || 
      responseText.includes("today") ||
      responseText.match(/\$\d+,?\d+/)
    );

    console.log("\n🔍 Analysis:");
    console.log(`  - Response length: ${responseText.length} characters`);
    console.log(`  - Contains price data: ${hasRealPrice ? "✅ YES" : "❌ NO"}`);
    console.log(`  - Mentions searching: ${responseText.toLowerCase().includes("search") ? "✅ YES" : "❌ NO"}`);
    console.log(`  - Mentions real-time: ${responseText.toLowerCase().includes("real-time") ? "❌ FALLBACK" : "✅ USING SEARCH"}`);

    console.log("\n" + "=".repeat(60));
    if (hasRealPrice && !responseText.toLowerCase().includes("don't have")) {
      console.log("✅ Google Search is WORKING!");
    } else {
      console.log("⚠️  Google Search may NOT be invoked - model returning trained data");
    }
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Gemini API Test Failed!");
    console.error("Error:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  }
}

testGeminiAPI();
