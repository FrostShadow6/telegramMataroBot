import { chromium } from "playwright";
import { promises as fs } from "fs";
import TelegramBot from "node-telegram-bot-api";

const URL = "https://www.tvmataro.cat/ca/sp/tauler-anuncis";
const STATE_FILE = "./lastMain.json";

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

// Funció per obtenir el text dins del <main>
async function getMainText(): Promise<string | null> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });

  const mainText = await page.evaluate(() => {
    const main = document.querySelector("main");
    return main ? main.innerText.trim() : null;
  });

  await browser.close();
  return mainText;
}

// Funció que comprova si ha canviat i envia avisos
async function checkAnunci() {
  const trimmed = await getMainText();
  if (!trimmed) {
    console.error("No s'ha trobat cap element <main> o està buit.");
    return;
  }

  const lastValue = await readLastValue();

  if (lastValue && trimmed !== lastValue) {
    console.log("⚠️ El contingut dins del <main> ha canviat");
    console.log("Abans:", lastValue.slice(0, 100));
    console.log("Ara:", trimmed.slice(0, 100));

    for (const chatId of CHAT_IDS) {
      await bot.sendMessage(
        chatId,
        `📢 Nou anunci a TVMataró:\n\n${trimmed.slice(0, 3000)}\n\n🔗 ${URL}`
      );
    }
  } else if (!lastValue) {
    console.log("Guardat valor inicial dins de <main>.");
  } else {
    console.log("Sense canvis dins de <main>.");
  }

  await writeLastValue(trimmed);
}

// Comanda /check per Telegram
bot.onText(/\/check/, async (msg) => {
  const chatId = msg.chat.id;
  const trimmed = await getMainText();
  if (trimmed) {
    await bot.sendMessage(chatId, `🔍 Contingut actual de la pàgina:\n\n${trimmed.slice(0, 3000)}`);
  } else {
    await bot.sendMessage(chatId, "❌ ERROR: No s'ha pogut trobar cap element <main>.");
  }
});

setInterval(checkAnunci, 60 * 1000);
checkAnunci();