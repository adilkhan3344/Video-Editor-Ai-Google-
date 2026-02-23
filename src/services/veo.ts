import { GoogleGenAI } from "@google/genai";

export async function checkApiKey() {
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    return await (window as any).aistudio.hasSelectedApiKey();
  }
  return false;
}

export async function openKeySelector() {
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    await (window as any).aistudio.openSelectKey();
  }
}

export async function generateVideo(prompt: string, options: { 
  image?: { data: string, mimeType: string },
  video?: any,
  aspectRatio?: '16:9' | '9:16',
  resolution?: '720p' | '1080p'
} = {}) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const config = {
    numberOfVideos: 1,
    resolution: options.resolution || '720p',
    aspectRatio: options.aspectRatio || '16:9',
  };

  let operation;
  if (options.video) {
    operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      video: options.video,
      config
    });
  } else if (options.image) {
    operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      image: {
        imageBytes: options.image.data,
        mimeType: options.image.mimeType,
      },
      config
    });
  } else {
    operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config
    });
  }

  return operation;
}

export async function pollOperation(operationId: any) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let operation = operationId;

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("No video generated");

  const response = await fetch(downloadLink, {
    method: 'GET',
    headers: {
      'x-goog-api-key': process.env.GEMINI_API_KEY || '',
    },
  });

  if (!response.ok) throw new Error("Failed to download video");
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function analyzeScenes(videoUrl: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // Fetch video blob
  const response = await fetch(videoUrl);
  const blob = await response.blob();
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: "video/mp4"
            }
          },
          {
            text: "Analyze this video and identify key scenes. Return a JSON array of objects with 'timestamp' (number in seconds), 'description' (string), and 'confidence' (number 0-1). Only return the JSON."
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    const scenes = JSON.parse(result.text || "[]");
    return scenes;
  } catch (e) {
    console.error("Failed to parse scenes", e);
    return [];
  }
}
