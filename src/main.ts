import { Application } from "pixi.js";
import { readBrowserGameData } from "./browserData";
import { formatIssues, loadGameData } from "./core/data/loader";
import { startBattleScene } from "./scenes/BattleScene";

const BACKGROUND = "#14161a";

function showError(message: string): void {
  const element = document.getElementById("boot-error");
  if (!element) return;
  element.textContent = message;
  element.style.display = "block";
}

async function boot(): Promise<void> {
  const { data, issues } = loadGameData(readBrowserGameData());

  if (issues.length > 0) {
    // 데이터가 완전하지 않아도 가능한 만큼은 띄운다(NFR-03). 문제는 숨기지 않고 콘솔로 알린다.
    console.warn(`데이터 문제 ${issues.length}건\n${formatIssues(issues)}`);
  }

  if (!data) {
    showError(`데이터를 읽지 못해 실행할 수 없다.\n\n${formatIssues(issues)}`);
    return;
  }

  const stage = data.stages[0];
  if (!stage) {
    showError("스테이지 데이터가 없다 (data/scenario/stages/).");
    return;
  }

  const app = new Application();
  await app.init({
    width: data.config.logicalWidth,
    height: data.config.logicalHeight,
    background: BACKGROUND,
    antialias: false,
  });

  const container = document.getElementById("app");
  if (!container) throw new Error("#app 요소가 없다");

  // 캔버스와 HUD가 같은 상자를 공유해야 오버레이 좌표가 화면과 어긋나지 않는다.
  const screen = document.createElement("div");
  screen.id = "screen";
  screen.style.width = `${data.config.logicalWidth}px`;
  screen.style.height = `${data.config.logicalHeight}px`;
  screen.appendChild(app.canvas);
  container.appendChild(screen);

  startBattleScene({ app, data, stage, hudParent: screen });
}

boot().catch((error: unknown) => {
  showError(`실행 중 오류가 발생했다.\n\n${String(error)}`);
  console.error(error);
});
