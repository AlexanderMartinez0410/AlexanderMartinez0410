import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const README_PATH = resolve(__dirname, '../README.md');

const USERNAME = 'AlexanderMartinez0410';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const headers = {
  'User-Agent': 'AlexanderMartinez-Readme-Updater',
  Accept: 'application/vnd.github.v3+json',
};
if (TOKEN) {
  headers.Authorization = `Bearer ${TOKEN}`;
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`Fetch error for ${url}: ${res.status} ${res.statusText}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`Network error for ${url}:`, err.message);
    return null;
  }
}

function timeAgo(dateString) {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `hace ${Math.max(1, diffMinutes)} min`;
  }
  if (diffHours < 24) {
    return `hace ${diffHours} h`;
  }
  if (diffDays === 1) {
    return 'ayer';
  }
  if (diffDays < 30) {
    return `hace ${diffDays} días`;
  }
  return past.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrentDateTime() {
  const now = new Date();
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
}

function formatActivityItem(event) {
  const repoName = event.repo?.name || 'repositorio';
  const repoUrl = `https://github.com/${repoName}`;
  const ago = timeAgo(event.created_at);
  const repoLink = `[\`${repoName}\`](${repoUrl})`;

  switch (event.type) {
    case 'PushEvent': {
      const commitCount = event.payload?.commits?.length || 1;
      const ref = (event.payload?.ref || 'main').replace('refs/heads/', '');
      const commitWord = commitCount === 1 ? 'commit' : 'commits';
      const msg = event.payload?.commits?.[0]?.message?.split('\n')[0] || '';
      const cleanMsg = msg ? ` — _"${msg.length > 50 ? msg.substring(0, 47) + '...' : msg}"_` : '';
      return `- 🔨 Pusheó **${commitCount} ${commitWord}** a ${repoLink} \`(${ref})\`${cleanMsg} · *${ago}*`;
    }
    case 'CreateEvent': {
      const kind = event.payload?.ref_type || 'rama/tag';
      const ref = event.payload?.ref ? `\`${event.payload.ref}\`` : '';
      return `- 🌱 Creó ${kind} ${ref} en ${repoLink} · *${ago}*`;
    }
    case 'WatchEvent':
      return `- ⭐ Marcó con estrella ${repoLink} · *${ago}*`;
    case 'ForkEvent': {
      const forkee = event.payload?.forkee?.full_name || '';
      return `- 🍴 Forkeó ${repoLink}${forkee ? ` hacia [\`${forkee}\`](https://github.com/${forkee})` : ''} · *${ago}*`;
    }
    case 'PullRequestEvent': {
      const action = event.payload?.action || 'actualizó';
      const num = event.payload?.pull_request?.number ? `#${event.payload.pull_request.number}` : '';
      const title = event.payload?.pull_request?.title || '';
      const cleanTitle = title ? ` _("${title.substring(0, 45)}...")_` : '';
      return `- 🔀 **${action}** Pull Request ${num} en ${repoLink}${cleanTitle} · *${ago}*`;
    }
    case 'IssuesEvent': {
      const action = event.payload?.action || 'interactuó con';
      const num = event.payload?.issue?.number ? `#${event.payload.issue.number}` : '';
      return `- 📌 **${action}** Issue ${num} en ${repoLink} · *${ago}*`;
    }
    case 'ReleaseEvent': {
      const tag = event.payload?.release?.tag_name || 'nueva versión';
      return `- 🚀 Publicó versión **${tag}** en ${repoLink} · *${ago}*`;
    }
    default:
      return `- ⚡ Actividad en ${repoLink} (${event.type.replace('Event', '')}) · *${ago}*`;
  }
}

async function run() {
  console.log(`[README-UPDATE] Obteniendo datos en tiempo real para ${USERNAME}...`);

  const [user, events, repos] = await Promise.all([
    fetchJSON(`https://api.github.com/users/${USERNAME}`),
    fetchJSON(`https://api.github.com/users/${USERNAME}/events/public?per_page=20`),
    fetchJSON(`https://api.github.com/users/${USERNAME}/repos?per_page=100&sort=updated`),
  ]);

  if (!user && !events && !repos) {
    console.error('[README-UPDATE] No se pudieron obtener datos de la API de GitHub.');
    return;
  }

  const publicRepos = user?.public_repos ?? (repos ? repos.length : 20);
  const totalStars = Array.isArray(repos)
    ? repos.reduce((acc, r) => acc + (r.stargazers_count || 0), 0)
    : 0;

  const currentEcuadorTime = formatCurrentDateTime();

  // Deduplicar eventos continuos para no saturar si hay múltiples pushes idénticos
  let activityLines = [];
  if (Array.isArray(events) && events.length > 0) {
    const seen = new Set();
    for (const evt of events) {
      const key = `${evt.type}-${evt.repo?.name}-${evt.payload?.ref || ''}`;
      if (seen.has(key) && evt.type === 'PushEvent') continue;
      seen.add(key);
      activityLines.push(formatActivityItem(evt));
      if (activityLines.length >= 6) break;
    }
  }

  if (activityLines.length === 0) {
    activityLines.push(`- 🚀 Trabajando activamente en proyectos full stack sobre Angular, .NET 8 y Flutter.`);
  }

  const realtimeStatsBlock = [
    `<!-- REALTIME_STATS:START -->`,
    `| 📊 Métrica en Vivo | Registro Actual | Estado Operativo |`,
    `| :--- | :--- | :--- |`,
    `| 🟢 **Disponibilidad Laboral** | \`Disponible // Remoto (UTC-5)\` | Full-Time / Consultoría B2B |`,
    `| 📦 **Repositorios Públicos** | \`${publicRepos} repositorios\` | Activo & Código Abierto |`,
    `| ⭐ **Estrellas en Proyectos** | \`${totalStars} estrellas\` | En constante contribución |`,
    `| 🕒 **Zona Horaria Activa** | \`America/Guayaquil (UTC-5)\` | Ecuador (Horario Comercial) |`,
    `| ⚡ **Última Telemetría** | \`${currentEcuadorTime} (UTC-5)\` | *Automated via GitHub Actions* |`,
    `<!-- REALTIME_STATS:END -->`,
  ].join('\n');

  const recentActivityBlock = [
    `<!-- RECENT_ACTIVITY:START -->`,
    activityLines.join('\n'),
    `<!-- RECENT_ACTIVITY:END -->`,
  ].join('\n');

  let readme = readFileSync(README_PATH, 'utf8');

  // Reemplazar bloques delimitados
  const statsRegex = /<!-- REALTIME_STATS:START -->[\s\S]*?<!-- REALTIME_STATS:END -->/;
  const activityRegex = /<!-- RECENT_ACTIVITY:START -->[\s\S]*?<!-- RECENT_ACTIVITY:END -->/;

  let updated = false;

  if (statsRegex.test(readme)) {
    readme = readme.replace(statsRegex, realtimeStatsBlock);
    updated = true;
  }
  if (activityRegex.test(readme)) {
    readme = readme.replace(activityRegex, recentActivityBlock);
    updated = true;
  }

  if (updated) {
    writeFileSync(README_PATH, readme, 'utf8');
    console.log('[README-UPDATE] README.md actualizado con éxito con telemetría en tiempo real.');
  } else {
    console.log('[README-UPDATE] No se encontraron los marcadores en README.md todavía.');
  }
}

run();
