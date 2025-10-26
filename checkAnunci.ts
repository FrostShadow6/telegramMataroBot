import { chromium } from "playwright";
import { promises as fs } from "fs";
import TelegramBot from "node-telegram-bot-api";

const URL = "https://www.tvmataro.cat/ca/sp/tauler-anuncis";
const STATE_FILE = "./lastStrong.json";

const BOT_TOKEN = "8388307739:AAEh6AwZ7F_j2RAZPp4RIUa60t4SeIu50mI";

const CHAT_IDS = [
  6594633168, // id de la Gemma
  368538229  // id meu
];

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

async function readLastValue(): Promise<string | null> {
  try {
    const data = await fs.readFile(STATE_FILE, "utf8");
    return JSON.parse(data).text;
  } catch {
    return null;
  }
}

async function writeLastValue(text: string) {
  await fs.writeFile(STATE_FILE, JSON.stringify({ text }), "utf8");
}

// Funció per obtenir el primer <strong>
async function getFirstStrong(): Promise<string | null> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const firstStrong = await page.textContent("strong");
  await browser.close();
  return firstStrong ? firstStrong.trim() : null;
}

// Funció que comprova si ha canviat i envia avisos
async function checkAnunci() {
  const trimmed = await getFirstStrong();
  if (!trimmed) {
    console.error("No s'ha trobat cap element <strong>.");
    return;
  }

  const lastValue = await readLastValue();

  if (lastValue && trimmed !== lastValue) {
    console.log("⚠️ El text del primer <strong> ha cambiat");
    console.log("Abans:", lastValue);
    console.log("Ara:", trimmed);

    for (const chatId of CHAT_IDS) {
      await bot.sendMessage(
        chatId,
        `📢 Nou anunci a TVMataró:\n\n${trimmed}\n\n🔗 ${URL}`
      );
    }
  } else if (!lastValue) {
    console.log("Guardat valor inicial:", trimmed);
  } else {
    console.log("Sense canvis. Text actual:", trimmed);
  }

  await writeLastValue(trimmed);
}

bot.onText(/\/check/, async (msg) => {
  const chatId = msg.chat.id;
  const trimmed = await getFirstStrong();
  if (trimmed) {
    await bot.sendMessage(chatId, `🔍 Ultima publicació:\n\n${trimmed}`);
  } else {
    await bot.sendMessage(chatId, "❌ ERROR: No s'ha pogut trobar cap publicació.");
  }
});

setInterval(checkAnunci, 60 * 1000);
checkAnunci();