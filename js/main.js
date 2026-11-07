/* Safe & Equal — frontend logic
   Loads all content from the backend (/api/content) and wires up
   the menu, the quiz (/api/quiz/answer) and the pledge (/api/pledges). */

const $ = (id) => document.getElementById(id);

/* Build DOM safely (textContent only, never innerHTML with data) */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* Static mode: no server. api() answers from window.SITE_CONTENT and localStorage,
   so the same UI code works on GitHub Pages. */
const SITE = window.SITE_CONTENT;
const PLEDGE_KEY = "safe-equal-pledges";

function readPledges() {
  try { return Number(localStorage.getItem(PLEDGE_KEY)) || 0; } catch { return 0; }
}
function writePledges(n) {
  try { localStorage.setItem(PLEDGE_KEY, String(n)); } catch { /* storage blocked */ }
}

async function api(path, options) {
  const method = (options && options.method) || "GET";
  const body = options && options.body ? JSON.parse(options.body) : {};

  if (method === "GET") {
    if (path === "/api/content") return SITE;
    if (path === "/api/quiz") {
      const { title, text, question, options: opts } = SITE.quiz;
      return { title, text, question, options: opts };
    }
    if (path === "/api/pledges") return { count: readPledges() };
  }
  if (method === "POST") {
    if (path === "/api/quiz/answer") {
      const choice = Number(body.choice);
      const q = SITE.quiz;
      if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) {
        throw new Error("Choose a valid option.");
      }
      return { correct: choice === q.correct, correctIndex: q.correct, explanation: q.explanations[choice] };
    }
    if (path === "/api/pledges") {
      const n = readPledges() + 1;
      writePledges(n);
      return { ok: true, count: n };
    }
  }
  throw new Error("Not found");
}

/* ---------- render sections ---------- */
function renderHero(c) {
  $("heroTitle").textContent = c.hero.title;
  $("heroIntro").textContent = c.hero.intro;
  $("heroValue").textContent = c.hero.headline.value;
  $("heroText").textContent = c.hero.headline.text;
  $("heroNote").textContent = c.hero.headline.note;
}

function renderIssue(c) {
  $("issueTitle").textContent = c.issue.title;
  $("issueText").textContent = c.issue.text;
  const box = $("issueCards");
  c.issue.cards.forEach((card) => {
    const item = el("article", "card");
    item.append(el("div", "icon", card.icon), el("h3", "", card.title), el("p", "", card.text));
    box.append(item);
  });
}

function renderStats(c) {
  $("statsTitle").textContent = c.stats.title;
  $("statsText").textContent = c.stats.text;
  $("statsSource").textContent = "Source: " + c.stats.source;
  const box = $("statsCards");
  c.stats.items.forEach((s) => {
    const item = el("article", "card");
    const num = el("div", "num", "0" + s.suffix);
    num.dataset.target = s.value;
    num.dataset.suffix = s.suffix;
    item.append(num, el("h3", "", s.title), el("p", "", s.text));
    box.append(item);
  });
  countUpOnView();
}

function renderLaws(c) {
  $("lawsTitle").textContent = c.laws.title;
  $("lawsText").textContent = c.laws.text;
  const box = $("lawsCards");
  c.laws.items.forEach((law) => {
    const item = el("article", "card");
    const link = el("a", "", "Read the law ↗");
    link.href = law.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    item.append(el("div", "tag", `${law.code} • ${law.year}`), el("h3", "", law.title), el("p", "", law.text), el("p", "", ""));
    item.lastChild.append(link);
    box.append(item);
  });
}

function renderAction(c) {
  $("actionTitle").textContent = c.action.title;
  $("actionText").textContent = c.action.text;
}

function renderRefs(c) {
  const list = $("refsList");
  c.references.forEach((r) => {
    const li = el("li");
    const a = el("a", "", r.label);
    a.href = r.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    li.append(a);
    list.append(li);
  });
  $("footNote").textContent = c.footer.note;
  $("footProject").textContent = c.footer.project;
  $("footMembers").textContent = "Group members: " + c.footer.members.join(" • ");
}

/* ---------- animated numbers (runs once, skipped for reduced motion) ---------- */
function countUpOnView() {
  const nums = document.querySelectorAll(".num[data-target]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const show = (n, v) => (n.textContent = v.toFixed(1) + n.dataset.suffix);

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const n = entry.target;
      const target = Number(n.dataset.target);
      io.unobserve(n);
      if (reduce) return show(n, target);
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / 900, 1);
        show(n, target * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.4 });
  nums.forEach((n) => io.observe(n));
}

/* ---------- quiz ---------- */
async function setupQuiz() {
  const quiz = await api("/api/quiz");
  $("quizTitle").textContent = quiz.title;
  $("quizText").textContent = quiz.text;
  $("quizQuestion").textContent = quiz.question;

  const box = $("quizOptions");
  const feedback = $("quizFeedback");
  const buttons = quiz.options.map((text, index) => {
    const b = el("button", "option", text);
    b.type = "button";
    b.addEventListener("click", () => answer(index));
    box.append(b);
    return b;
  });

  async function answer(index) {
    buttons.forEach((b) => (b.disabled = true));
    try {
      const result = await api("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice: index })
      });
      buttons[index].classList.add(result.correct ? "correct" : "wrong");
      buttons[result.correctIndex].classList.add("correct");
      feedback.textContent = result.explanation;
      feedback.className = "feedback " + (result.correct ? "ok" : "err");
    } catch (err) {
      feedback.textContent = err.message;
      feedback.className = "feedback err";
      buttons.forEach((b) => (b.disabled = false));
    }
  }
}

/* ---------- pledge ---------- */
async function setupPledge() {
  const count = $("pledgeCount");
  const msg = $("pledgeMsg");
  try { count.textContent = (await api("/api/pledges")).count; } catch { /* offline: keep 0 */ }

  $("pledgeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const result = await api("/api/pledges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: $("pledgeName").value })
      });
      count.textContent = result.count;
      msg.textContent = "Thank you for taking the pledge.";
      msg.className = "feedback ok";
      e.target.reset();
    } catch (err) {
      msg.textContent = err.message;
      msg.className = "feedback err";
    }
  });
}

/* ---------- menu ---------- */
function setupMenu() {
  const btn = $("menuBtn");
  const menu = $("menu");
  btn.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
  menu.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

/* ---------- start ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  setupMenu();
  try {
    const content = await api("/api/content");
    renderHero(content);
    renderIssue(content);
    renderStats(content);
    renderLaws(content);
    renderAction(content);
    renderRefs(content);
    await Promise.all([setupQuiz(), setupPledge()]);
  } catch (err) {
    const main = document.querySelector("main");
    const note = el("p", "feedback err", "Content could not load. Please refresh the page.");
    note.style.padding = "2rem";
    main.prepend(note);
    console.error(err);
  }
});
