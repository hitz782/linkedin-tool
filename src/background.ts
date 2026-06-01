console.log("Background Service Worker Loaded");

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;


async function generateComments(postText: string): Promise<string[]> {
    console.log("Generating comments for post text length:", postText.length);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are a professional networking on LinkedIn. Read this post and generate exactly 3 short, supportive, and authentic comments. Return them ONLY as a raw JSON array of strings without markdown formatting (e.g. ["comment1", "comment2", "comment3"]). Post text: ${postText || "A generic professional post on LinkedIn."}`
                    }]
                }]
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.statusText} (${response.status})`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log("Gemini API raw response text:", text);

        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log("Background received runtime message:", message);

    if (message.action === 'GENERATE_COMMENTS') {
        generateComments(message.text || '')
            .then((comments) => {
                console.log("Responding with comments:", comments);
                sendResponse(comments);
            })
            .catch((err) => {
                console.error("Failed to generate comments:", err);
                sendResponse({ error: err.message });
            });
        return true;
    }
    return false;
});
