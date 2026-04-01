#!/usr/bin/env node
/**
 * Generate yoga guidance audio files using Google Cloud Text-to-Speech API.
 *
 * Prerequisites:
 *   1. Go to https://console.cloud.google.com/apis/library/texttospeech.googleapis.com
 *      and enable the "Cloud Text-to-Speech API".
 *   2. Create an API key: https://console.cloud.google.com/apis/credentials
 *   3. Run:
 *        node scripts/gen-yoga-audio.mjs YOUR_API_KEY
 *
 * Output: public/audio/yoga/  (43 mp3 files)
 *
 * Free tier: 1 million characters/month (WaveNet) — we use ~2000 chars total.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'audio', 'yoga')

const API_KEY = process.argv[2]
if (!API_KEY) {
  console.error('\n  Usage: node scripts/gen-yoga-audio.mjs <GOOGLE_API_KEY>\n')
  process.exit(1)
}

const TTS_URL = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`

// ─── Voice config ────────────────────────────────────────────
const VOICE = {
  languageCode: 'cmn-TW',
  name: 'cmn-TW-Wavenet-A',   // Female, gentle
  ssmlGender: 'FEMALE',
}
const AUDIO_CONFIG = {
  audioEncoding: 'MP3',
  speakingRate: 0.85,          // Slower = more calming
  pitch: -1.5,                 // Slightly lower = warmer
  volumeGainDb: 0,
}

// ─── All texts to generate ───────────────────────────────────

// Pose guidance (spoken when each pose starts)
const poseTexts = [
  { id: 'pose_01', text: '閉眼，深呼吸。讓身體慢慢進入靜默。今日意圖是接受，而非對抗。' },
  { id: 'pose_02', text: '坐姿，腳掌相對，雙腳稍遠。身體緩慢前折，脊椎自然拱起，頭部放鬆垂下。感受大腿內側的延展，讓呼吸放鬆。' },
  { id: 'pose_03', text: '雙腿大幅度向兩側打開。身體緩慢往前折，雙手延伸，頭部放鬆。感受大腿內側從鼠蹊到膝蓋的深層延展。不要用力，讓重力慢慢帶你進去。' },
  { id: 'pose_04', text: '身體轉向左腿，雙手輕放於左膝上方地板。感受右側腰與左腿後側同時延展。保持呼吸，放鬆肩膀。' },
  { id: 'pose_05', text: '換邊，身體轉向右腿。觀察兩側的差異，不需要對抗它。保持呼吸，讓身體在這裡休息。' },
  { id: 'pose_06', text: '雙腿向前伸直。身體緩慢前彎，脊椎如拱橋般彎曲，頭部垂下。感受整條腿後側從坐骨到腳跟的延展。膝蓋可以微彎，不需要強迫直腿。' },
  { id: 'pose_07', text: '左腿向前伸直，右腿屈膝踩在左大腿內側。身體折向左腿，感受左腿後側單獨的深層延展。頭部放鬆垂下。' },
  { id: 'pose_08', text: '換邊，右腿向前伸直。身體折向右腿，感受右腿後側的延展。觀察兩側的不同，這很正常。' },
  { id: 'pose_09', text: '四足跪姿，雙膝緩慢向兩側滑開。感受大腿內側強烈的延展感。腳趾與膝蓋對齊，腳掌朝外。骨盆慢慢沉向地板。請尊重你的身體邊界。' },
  { id: 'pose_10', text: '仰臥，腳掌相對，膝蓋向兩側打開。完全放重，讓重力自然開展鼠蹊。感受身體在這裡整合，完全不需要用力。' },
  { id: 'pose_11', text: '仰臥，左腿向上抬起，雙手抱住左大腿後側。緩慢將左腿拉向身體，感受腿後肌的延展。腳趾可以輕輕繞圈。保持骨盆貼地。' },
  { id: 'pose_12', text: '換腿，右腿向上抬起。保持骨盆貼地，感受從坐骨到腳跟的整條線延展。讓呼吸帶你更深入。' },
  { id: 'pose_13', text: '左腿向前伸直，右腿屈膝腳跟靠近右臀。身體緩慢向後躺下。感受右側大腿前側的深層延展。若膝蓋不適，請調整角度。' },
  { id: 'pose_14', text: '換邊，右腿向前伸直，左腿屈膝靠近左臀。身體向後躺，感受左側大腿前側的延展。緩慢呼吸，讓重力帶你進入。' },
  { id: 'pose_15', text: '雙腿屈膝，臀部坐在腳跟之間。身體緩慢向後躺。感受整個大腿前側與腹部的開展。若腰椎感到疼痛，請立即起身用半鞍式代替。' },
  { id: 'pose_16', text: '仰臥，手肘撐地，讓胸口向上打開。頭部輕輕後仰。感受胸腔的開展，肺部完整擴張。這裡儲存著許多壓抑的情緒，讓它們自然流動。' },
  { id: 'pose_17', text: '四足跪姿，右手從左腋下穿過，右肩與右耳貼地。感受右側肩膀與胸大肌的深層伸展。讓胸口自然打開。' },
  { id: 'pose_18', text: '換邊，左手從右腋下穿過，左肩與左耳貼地。感受左側肩膀與胸大肌的深層伸展。呼吸放鬆，肩膀自然沉向地板。' },
  { id: 'pose_19', text: '仰臥，雙膝倒向左側，右臂展開，視線看向右手。讓脊椎在這裡輕輕旋轉。呼吸放鬆，肩膀盡量貼地。三分鐘後我們會換邊。' },
  { id: 'pose_20', text: '完全仰臥，放鬆一切。讓身體整合今日所有的開展。腿內側、腿後側、大腿前側、胸腔，所有的釋放都在這裡匯聚。什麼都不需要做，只是存在。' },
]

// System prompts
const systemTexts = [
  { id: 'halfway',  text: '一半時間到，繼續保持，讓呼吸帶你更深入。' },
  { id: 'ten_sec',  text: '還有十秒，準備緩慢起身。' },
  { id: 'finish',   text: '練習圓滿完成。讓身體靜靜整合。願你帶著這份寧靜進入今天的其餘時光。' },
]

// Transition phrases: "接下來是 XXX"
const poseNames = [
  '寬腳蝴蝶式', '蜻蜓式', '側蜻蜓式左側', '側蜻蜓式右側',
  '毛毛蟲式', '半毛毛蟲式左側', '半毛毛蟲式右側', '青蛙式',
  '臥蝴蝶式', '仰臥腿後側伸展左側', '仰臥腿後側伸展右側',
  '半鞍式左側', '半鞍式右側', '完整鞍式', '魚式',
  '嬰兒式開胸伸展左側', '嬰兒式開胸伸展右側', '脊椎扭轉', '攝屍式',
]

const transitionTexts = poseNames.map((name, i) => ({
  id: `next_${String(i + 2).padStart(2, '0')}`,
  text: `接下來是${name}。`,
}))

const allEntries = [...poseTexts, ...systemTexts, ...transitionTexts]

// ─── Generate ────────────────────────────────────────────────
async function synthesize(text) {
  const body = {
    input: { text },
    voice: VOICE,
    audioConfig: AUDIO_CONFIG,
  }

  const res = await fetch(TTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`TTS API error ${res.status}: ${err}`)
  }

  const json = await res.json()
  return Buffer.from(json.audioContent, 'base64')
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true })
  }

  console.log(`\n  Generating ${allEntries.length} audio files...\n`)
  console.log(`  Output: ${OUT_DIR}\n`)

  let success = 0
  for (const entry of allEntries) {
    const filePath = join(OUT_DIR, `${entry.id}.mp3`)
    process.stdout.write(`  [${success + 1}/${allEntries.length}] ${entry.id} ... `)
    try {
      const audio = await synthesize(entry.text)
      writeFileSync(filePath, audio)
      console.log(`✓  (${(audio.length / 1024).toFixed(1)} KB)`)
      success++
    } catch (err) {
      console.log(`✗  ${err.message}`)
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n  Done! ${success}/${allEntries.length} files generated.\n`)
}

main()
