export async function parseBothScorecards(imageFile, label1, label2) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not set in .env.local')

  const base64 = await toBase64(imageFile)
  const mimeType = imageFile.type || 'image/jpeg'

  const prompt = `You are analyzing a photo of a bowling scoring display showing multiple players.

Find players labeled "${label1}" and "${label2}" and extract their complete frame-by-frame data.

Return ONLY a raw JSON object — no markdown, no code fences, no explanation:
{
  "players": [
    {
      "label": "${label1}",
      "found": true,
      "totalScore": 200,
      "frames": [
        {"frame": 1, "balls": ["X"], "runningScore": 30, "split": false, "splitPickedUp": false},
        {"frame": 2, "balls": ["7", "2"], "runningScore": 39, "split": false, "splitPickedUp": false},
        {"frame": 3, "balls": ["9", "/"], "runningScore": 59, "split": false, "splitPickedUp": false},
        {"frame": 4, "balls": ["X"], "runningScore": 79, "split": false, "splitPickedUp": false},
        {"frame": 5, "balls": ["X"], "runningScore": 99, "split": false, "splitPickedUp": false},
        {"frame": 6, "balls": ["9", "/"], "runningScore": 119, "split": false, "splitPickedUp": false},
        {"frame": 7, "balls": ["X"], "runningScore": 149, "split": false, "splitPickedUp": false},
        {"frame": 8, "balls": ["X"], "runningScore": 169, "split": false, "splitPickedUp": false},
        {"frame": 9, "balls": ["X"], "runningScore": 189, "split": false, "splitPickedUp": false},
        {"frame": 10, "balls": ["9", "/", "X"], "runningScore": 209, "split": false, "splitPickedUp": false}
      ]
    },
    {
      "label": "${label2}",
      "found": true,
      "totalScore": 180,
      "frames": [
        {"frame": 1, "balls": ["7", "2"], "runningScore": 9, "split": false, "splitPickedUp": false},
        {"frame": 2, "balls": ["X"], "runningScore": 39, "split": false, "splitPickedUp": false},
        {"frame": 3, "balls": ["X"], "runningScore": 59, "split": false, "splitPickedUp": false},
        {"frame": 4, "balls": ["9", "/"], "runningScore": 79, "split": false, "splitPickedUp": false},
        {"frame": 5, "balls": ["X"], "runningScore": 99, "split": false, "splitPickedUp": false},
        {"frame": 6, "balls": ["8", "1"], "runningScore": 108, "split": false, "splitPickedUp": false},
        {"frame": 7, "balls": ["X"], "runningScore": 128, "split": false, "splitPickedUp": false},
        {"frame": 8, "balls": ["X"], "runningScore": 148, "split": false, "splitPickedUp": false},
        {"frame": 9, "balls": ["X"], "runningScore": 168, "split": false, "splitPickedUp": false},
        {"frame": 10, "balls": ["8", "/", "7"], "runningScore": 185, "split": false, "splitPickedUp": false}
      ]
    }
  ]
}

BALL NOTATION — use exactly these strings:
- "X"  = strike (frames 1-9 have ONLY ONE ball entry when it's a strike)
- "/"  = spare (second ball knocked down remaining pins)
- "-"  = gutter / zero pins
- "1" through "9" = that many pins

STRIKE vs SPARE: A strike shows only ONE ball for the frame (frames 1-9). A number followed by "/" is a SPARE — record as ["number", "/"]. Only use "X" when all 10 pins fell on the FIRST ball with no second ball shown.

FRAME 10 RULES:
- Ball 1 strike → 3 total balls: ["X", "X", "X"] or ["X", "7", "/"] etc.
- Balls 1+2 spare → 3 total balls: ["9", "/", "X"] etc.
- Otherwise → 2 balls only: ["7", "2"]

SPLITS: Set "split": true when a red circle appears around the first ball's pin count. Set "splitPickedUp": true if split frame also has "/" as second ball.

If a player label is not found, set "found": false and "frames": [] for that entry.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API error ${res.status}`)
  }

  const result = await res.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty response from Gemini')

  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
}

export async function parseScorecard(imageFile, playerLabel) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY is not set in .env.local')

  const base64 = await toBase64(imageFile)
  const mimeType = imageFile.type || 'image/jpeg'

  const prompt = `You are analyzing a photo of a bowling scoring display screen.

Find the player or lane labeled "${playerLabel}" and extract their complete frame-by-frame bowling data.

Return ONLY a raw JSON object — no markdown, no code fences, no explanation:
{
  "found": true,
  "totalScore": 236,
  "frames": [
    {"frame": 1, "balls": ["X"], "runningScore": 30, "split": false, "splitPickedUp": false},
    {"frame": 2, "balls": ["X"], "runningScore": 60, "split": false, "splitPickedUp": false},
    {"frame": 3, "balls": ["X"], "runningScore": 90, "split": false, "splitPickedUp": false},
    {"frame": 4, "balls": ["X"], "runningScore": 119, "split": false, "splitPickedUp": false},
    {"frame": 5, "balls": ["X"], "runningScore": 138, "split": false, "splitPickedUp": false},
    {"frame": 6, "balls": ["9", "-"], "runningScore": 147, "split": false, "splitPickedUp": false},
    {"frame": 7, "balls": ["7", "/"], "runningScore": 167, "split": false, "splitPickedUp": false},
    {"frame": 8, "balls": ["X"], "runningScore": 196, "split": false, "splitPickedUp": false},
    {"frame": 9, "balls": ["X"], "runningScore": 216, "split": false, "splitPickedUp": false},
    {"frame": 10, "balls": ["9", "/", "X"], "runningScore": 236, "split": false, "splitPickedUp": false}
  ]
}

BALL NOTATION — use exactly these strings:
- "X"  = strike (first ball knocked down all 10 pins; frames 1-9 have ONLY ONE ball entry when it's a strike)
- "/"  = spare (second ball knocked down the remaining pins)
- "-"  = gutter / zero pins
- "1" through "9" = that many pins knocked down

STRIKE vs SPARE — pay close attention:
- A strike shows only ONE ball for the frame (frames 1-9). If you see a number followed by a "/" that is a SPARE, not a strike — record it as ["number", "/"].
- Only use "X" when all 10 pins were knocked down on the FIRST ball of a frame with no second ball shown.

FRAME 10 RULES:
- Ball 1 is strike → 2 more fill balls (3 total); e.g. ["X", "X", "X"] or ["X", "7", "/"]
- Balls 1+2 are spare → 1 fill ball (3 total); e.g. ["9", "/", "X"] = 1 spare + 1 fill strike
- Otherwise → 2 balls only, no fill ball; e.g. ["7", "2"]
- The fill ball(s) in frame 10 are bonus balls only — do NOT count them as additional spares or strikes beyond what's recorded in the balls array

SPLITS:
- A split is indicated by a red circle (or red ring) drawn around or behind the pin count on the first ball of a frame.
- Set "split": true for any frame where the first ball shows this red circle indicator.
- Set "splitPickedUp": true if a split frame also has a "/" (spare) as the second ball — meaning the bowler converted the split.
- If there is no red circle on the first ball, "split" and "splitPickedUp" are both false.

If player "${playerLabel}" is not visible or unreadable, return:
{"found": false, "error": "brief reason"}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API error ${res.status}`)
  }

  const result = await res.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty response from Gemini')

  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
