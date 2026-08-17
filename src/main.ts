import { Application } from "pixi.js";
import { readBrowserGameData } from "./browserData";
import { formatIssues, loadGameData } from "./core/data/loader";
import { createTilemapLayer } from "./render/TilemapRenderer";

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
  container.appendChild(app.canvas);

  const tilemap = createTilemapLayer(stage, data.terrain, data.config);
  tilemap.x = Math.round((data.config.logicalWidth - stage.map.width * data.config.tileSize) / 2);
  tilemap.y = Math.round((data.config.logicalHeight - stage.map.height * data.config.tileSize) / 2);
  app.stage.addChild(tilemap);

  console.info(
    `${stage.name} (${stage.map.width}×${stage.map.height}) 렌더 완료 — 지형 ${data.terrain.length}종, 병과 ${data.classes.length}종`,
  );
}

boot().catch((error: unknown) => {
  showError(`실행 중 오류가 발생했다.\n\n${String(error)}`);
  console.error(error);
});
