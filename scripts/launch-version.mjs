import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSIONS = {
  v1: {
    label: "버전 1 (bdbdgmain)",
    branch: "main",
    port: 3001,
    worktreeDir: "bdbdgmain1",
    needsLucide: false,
  },
  v2: {
    label: "버전 2 (bdbdgmain2)",
    branch: "design/unslop-redesign",
    port: 3002,
    worktreeDir: "bdbdgmain2",
    needsLucide: true,
  },
  v3: {
    label: "버전 3 (bdbdgmain3)",
    branch: "feat/bdbdgmain3-menu-reorg",
    port: 3003,
    worktreeDir: "bdbdgmain3",
    needsLucide: true,
  },
};

const versionKey = process.argv[2];
const target = VERSIONS[versionKey];

if (!target) {
  console.error("사용법: node scripts/launch-version.mjs <v1|v2|v3>");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const initialRoot = path.resolve(scriptDir, "..");

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "localhost", port });
    socket.setTimeout(400);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function openBrowser(url) {
  spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
}

function getWorktrees(rootDir) {
  const out = execFileSync("git", ["worktree", "list", "--porcelain"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  const list = [];
  let current = {};
  for (const rawLine of out.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (current.worktree) list.push(current);
      current = {};
      continue;
    }
    if (line.startsWith("worktree ")) {
      current.worktree = path.normalize(line.slice("worktree ".length));
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length);
    }
  }
  if (current.worktree) list.push(current);
  return list;
}

function refExists(rootDir, ref) {
  const res = spawnSync("git", ["show-ref", "--verify", "--quiet", ref], {
    cwd: rootDir,
  });
  return res.status === 0;
}

function ensureTargetWorktree(rootDir, cfg) {
  const worktrees = getWorktrees(rootDir);
  const fullRef = `refs/heads/${cfg.branch}`;
  const existing = worktrees.find((w) => w.branch === fullRef && fs.existsSync(w.worktree));
  if (existing) {
    return existing.worktree;
  }

  const targetDir = path.join(rootDir, cfg.worktreeDir);
  console.log(`[초기 세팅] '${cfg.branch}' 워크트리를 준비합니다: ${targetDir}`);

  if (!refExists(rootDir, fullRef)) {
    const remoteRef = `refs/remotes/origin/${cfg.branch}`;
    if (!refExists(rootDir, remoteRef)) {
      console.log(`[초기 세팅] 원격 저장소에서 '${cfg.branch}' 브랜치를 가져옵니다...`);
      execFileSync("git", ["fetch", "origin", cfg.branch], {
        cwd: rootDir,
        stdio: "inherit",
      });
    }
    execFileSync("git", ["worktree", "add", "-b", cfg.branch, targetDir, `origin/${cfg.branch}`], {
      cwd: rootDir,
      stdio: "inherit",
    });
  } else {
    execFileSync("git", ["worktree", "add", targetDir, cfg.branch], {
      cwd: rootDir,
      stdio: "inherit",
    });
  }

  return targetDir;
}

function ensureNodeModules(rootDir, targetDir, needsLucide) {
  const rootNodeModules = path.join(rootDir, "node_modules");
  const viteBin = path.join(rootNodeModules, "vite", "bin", "vite.js");

  if (!fs.existsSync(viteBin)) {
    console.log("[초기 세팅] 루트 node_modules 패키지를 설치합니다 (npm install)...");
    spawnSync("cmd", ["/c", "npm", "install"], { cwd: rootDir, stdio: "inherit" });
  }

  if (needsLucide && !fs.existsSync(path.join(rootNodeModules, "lucide-react"))) {
    console.log("[초기 세팅] v2/v3용 lucide-react 패키지를 추가 설치합니다...");
    spawnSync("cmd", ["/c", "npm", "install", "lucide-react@^1.72.0", "--no-save"], {
      cwd: rootDir,
      stdio: "inherit",
    });
  }

  const targetNodeModules = path.join(targetDir, "node_modules");
  if (!fs.existsSync(targetNodeModules)) {
    console.log(`[초기 세팅] node_modules 연결(Junction) 생성: ${targetNodeModules}`);
    execFileSync("cmd", ["/c", "mklink", "/J", targetNodeModules, rootNodeModules], {
      stdio: "inherit",
    });
  }
}

function ensureEnvAndViteLocal(rootDir, targetDir) {
  const targetEnv = path.join(targetDir, ".env");
  if (!fs.existsSync(targetEnv)) {
    const candidates = [
      path.join(rootDir, ".env"),
      path.join(rootDir, "bdbdgmain1", ".env"),
      path.join(rootDir, "bdbdgmain2", ".env"),
      path.join(rootDir, "bdbdgmain3", ".env"),
    ];
    const found = candidates.find((p) => fs.existsSync(p));
    if (found) {
      fs.copyFileSync(found, targetEnv);
      console.log(`[초기 세팅] .env 환경변수 파일을 복사했습니다.`);
    } else {
      console.warn("========================================================");
      console.warn("[주의] .env 파일이 없습니다! Firebase 연결을 위해");
      console.warn(`       ${path.join(rootDir, ".env")} 파일을 넣어주세요.`);
      console.warn("========================================================");
    }
  }

  const viteLocalPath = path.join(targetDir, "vite.local.mjs");
  const viteLocalContent = [
    "import { mergeConfig } from 'vite';",
    "import baseConfig from './vite.config.mjs';",
    "",
    "export default (env) =>",
    "  mergeConfig(",
    "    typeof baseConfig === 'function' ? baseConfig(env) : baseConfig,",
    "    { cacheDir: '.vite-cache' }",
    "  );",
    "",
  ].join("\n");
  fs.writeFileSync(viteLocalPath, viteLocalContent, "utf8");
}

async function main() {
  const url = `http://localhost:${target.port}`;
  console.log("========================================================");
  console.log(`  [${target.label}] 브랜치: ${target.branch}`);
  console.log(`  접속 주소 : ${url}`);
  console.log("  종료 방법 : 이 창에서 Ctrl+C 또는 창 닫기");
  console.log("========================================================\n");

  if (await isPortListening(target.port)) {
    console.log(`[안내] 이미 ${target.port} 포트로 실행 중입니다. 브라우저를 엽니다...`);
    openBrowser(url);
    await new Promise((r) => setTimeout(r, 2000));
    process.exit(0);
  }

  const repoRoot = getWorktrees(initialRoot)[0]?.worktree || initialRoot;
  const targetDir = ensureTargetWorktree(repoRoot, target);
  ensureNodeModules(repoRoot, targetDir, target.needsLucide);
  ensureEnvAndViteLocal(repoRoot, targetDir);

  console.log(`[실행 폴더] ${targetDir}\n`);

  const viteJs = path.join(targetDir, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(
    process.execPath,
    [viteJs, "--config", "vite.local.mjs", "--port", String(target.port), "--strictPort", "--open"],
    { cwd: targetDir, stdio: "inherit" }
  );

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("\n[오류] 실행 중 예외가 발생했습니다:", err.message || err);
  process.exit(1);
});
