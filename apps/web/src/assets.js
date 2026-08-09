/* Real Windows XP assets, inlined by Vite at build.
   Icons: ShizukuIchi/winXP (MIT) — shell32-numbered + named PNGs.
   Sounds: the 2001 Windows XP sound scheme + MSN Messenger 7.
   Wallpaper: Bliss, the original crop. Flag: commons vector, genuine palette. */

import wallBliss from "./assets/xp/wall/bliss.jpg";
import logoFlag from "./assets/xp/logo/xp-flag.svg";
import startBtn from "./assets/xp/icons/start.png";

import computer16 from "./assets/xp/icons/676(16x16).png";
import computer32 from "./assets/xp/icons/676(32x32).png";
import bin32 from "./assets/xp/icons/360(32x32).png";
import folder16 from "./assets/xp/icons/318(16x16).png";
import folder32 from "./assets/xp/icons/318(32x32).png";
import note16 from "./assets/xp/icons/327(16x16).png";
import note32 from "./assets/xp/icons/327(32x32).png";
import ie16 from "./assets/xp/icons/ie-paper.png";
import ie32 from "./assets/xp/icons/ie.png";
import msn16 from "./assets/xp/icons/msn.png";
import msn32 from "./assets/xp/icons/853(32x32).png";
import amp16 from "./assets/xp/icons/winamp.png";
import err16 from "./assets/xp/icons/897(16x16).png";
import err32 from "./assets/xp/icons/897(32x32).png";
import user48 from "./assets/xp/icons/user.png";
import docs32 from "./assets/xp/icons/308(32x32).png";
import pics32 from "./assets/xp/icons/307(32x32).png";
import music32 from "./assets/xp/icons/550(32x32).png";
import cpanel32 from "./assets/xp/icons/300(32x32).png";
import connect32 from "./assets/xp/icons/309(32x32).png";
import printer32 from "./assets/xp/icons/549(32x32).png";
import help32 from "./assets/xp/icons/747(32x32).png";
import search32 from "./assets/xp/icons/299(32x32).png";
import run32 from "./assets/xp/icons/743(32x32).png";
import lock32 from "./assets/xp/icons/546(32x32).png";
import off32 from "./assets/xp/icons/310(32x32).png";
import outlook32 from "./assets/xp/icons/887(32x32).png";
import wmp32 from "./assets/xp/icons/846(32x32).png";
import allProg from "./assets/xp/icons/all-programs.ico";
import trayVol from "./assets/xp/icons/690(16x16).png";
import trayUsb from "./assets/xp/icons/394(16x16).png";
import trayRisk from "./assets/xp/icons/229(16x16).png";
import offBig from "./assets/xp/icons/windows-off.png";
import flag16 from "./assets/xp/icons/windows.png";

import sndStartup from "./assets/xp/sounds/startup.wav";
import sndLogon from "./assets/xp/sounds/logon.wav";
import sndLogoff from "./assets/xp/sounds/logoff.wav";
import sndShutdown from "./assets/xp/sounds/shutdown.wav";
import sndBalloon from "./assets/xp/sounds/balloon.wav";
import sndCritical from "./assets/xp/sounds/critical.wav";
import sndExclaim from "./assets/xp/sounds/exclamation.wav";
import sndDing from "./assets/xp/sounds/ding.wav";
import sndMinimize from "./assets/xp/sounds/minimize.wav";
import sndRestore from "./assets/xp/sounds/restore.wav";
import sndNav from "./assets/xp/sounds/navclick.wav";
import sndRecycle from "./assets/xp/sounds/recycle.wav";
import sndHwIn from "./assets/xp/sounds/hw-insert.wav";
import sndHwOut from "./assets/xp/sounds/hw-remove.wav";
import sndTada from "./assets/xp/sounds/tada.wav";
import msnAlert from "./assets/xp/msn/newalert.wav";
import msnNudge from "./assets/xp/msn/nudge.wav";
import msnOnline from "./assets/xp/msn/online.wav";

export const IMG = {
  bliss: wallBliss, flag: logoFlag, startBtn,
  computer16, computer32, bin32, folder16, folder32, note16, note32,
  ie16, ie32, msn16, msn32, amp16, err16, err32, user48,
  docs32, pics32, music32, cpanel32, connect32, printer32,
  help32, search32, run32, lock32, off32, outlook32, wmp32, allProg,
  trayVol, trayUsb, trayRisk, offBig, flag16,
};

import trkMonkeys from "./assets/music/monkeys-spinning-monkeys.mp3";
import trkSnitch from "./assets/music/sneaky-snitch.mp3";
import trkDuck from "./assets/music/fluffing-a-duck.mp3";
import trkElevator from "./assets/music/local-forecast-elevator.mp3";

/* Kevin MacLeod (incompetech.com), CC BY 4.0 — the legally shippable meme canon. */
export const TRACKS = [
  { url: trkMonkeys, artist: "Kevin MacLeod", title: "Monkeys Spinning Monkeys" },
  { url: trkSnitch, artist: "Kevin MacLeod", title: "Sneaky Snitch" },
  { url: trkDuck, artist: "Kevin MacLeod", title: "Fluffing a Duck" },
  { url: trkElevator, artist: "Kevin MacLeod", title: "Local Forecast - Elevator" },
];

/* Minesweeper sprite set (winXP repo, MIT): digits 13x23, cells 16x16 */
const mineGlob = import.meta.glob("./assets/xp/mine/*.png", { eager: true, query: "?url", import: "default" });
export const MINE = Object.fromEntries(
  Object.entries(mineGlob).map(([p, url]) => [p.split("/").pop().replace(/\.png$/, ""), url])
);
IMG.mine16 = MINE["mine-icon"];
IMG.mine32 = MINE["mine-icon"];

export const SNDF = {
  startup: sndStartup, logon: sndLogon, logoff: sndLogoff, shutdown: sndShutdown,
  balloon: sndBalloon, critical: sndCritical, exclaim: sndExclaim, ding: sndDing,
  minimize: sndMinimize, restore: sndRestore, nav: sndNav, recycle: sndRecycle,
  hwin: sndHwIn, hwout: sndHwOut, tada: sndTada,
  msnAlert, msnNudge, msnOnline,
};
