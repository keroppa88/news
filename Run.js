// Run.js: 同一フォルダ内の .js を名前順で実行する

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- 設定 ---
const BASE_DIR = __dirname; // または 'C:\\Users\\kaika\\Dropbox\\playwright'
const LOG_DIR = path.join(BASE_DIR, 'logs');
const INTERVAL_MS = 5000; // スクリプト間の待機時間

// ログディレクトリ作成
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// ログファイル名（実行日時）
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const logFile = path.join(LOG_DIR, `run_${timestamp}.log`);

function log(msg) {
  const line = `[${new Date().toLocaleString('ja-JP')}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runScript(filePath) {
  return new Promise(resolve => {
    const name = path.basename(filePath);
    log(`開始: ${name}`);
    const start = Date.now();

    const proc = spawn('node', [filePath], {
      stdio: 'pipe',
      cwd: BASE_DIR, 
    });

    let stdout = '', stderr = '';

    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', code => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      if (code === 0) {
        log(`完了: ${name} (${elapsed}秒)`);
      } else {
        log(`失敗: ${name} (コード:${code}, ${elapsed}秒)`);
        if (stderr.trim()) log(`  エラー: ${stderr.trim()}`);
      }
      if (stdout.trim()) log(`  出力: ${stdout.trim()}`);
      resolve(code);
    });

    proc.on('error', err => {
      log(`実行エラー: ${name} - ${err.message}`);
      resolve(1);
    });
  });
}

async function main() {
  log('=== 実行プロセス開始 ===');

  // 直下の .js を取得（Run.js自身は除外）
  const files = fs.readdirSync(BASE_DIR)
    .filter(f => f.endsWith('.js') && f !== 'Run.js')
    .sort() // 名前順（大文字優先）
    .map(f => path.join(BASE_DIR, f));

  if (files.length === 0) {
    log('実行対象のスクリプトが見つかりませんでした。');
  } else {
    log(`${files.length} 個のスクリプトを順番に実行します。`);

    for (let i = 0; i < files.length; i++) {
      await runScript(files[i]);
      
      // 最後のスクリプト以外は待機を入れる
      if (i < files.length - 1 && INTERVAL_MS > 0) {
        log(`${INTERVAL_MS / 1000}秒待機中...`);
        await sleep(INTERVAL_MS);
      }
    }
  }

  log('=== すべてのスクリプトの実行を終了しました ===');
}

main();