'use client'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import EpisodeBoard from '@/components/EpisodeBoard'
import StatusBanner from '@/components/StatusBanner'
import Walkthrough from '@/components/Walkthrough'
import Reveal from '@/components/Reveal'
import CountUp from '@/components/CountUp'
import { ArrowRight, ArrowUpRight, ExternalLink } from 'lucide-react'

const BUILD_STEPS = [
  {
    n: '01',
    title: 'The environment',
    body: 'An OpenEnv-compatible API — /reset, /step, /grader — served by FastAPI on port 7860. Fully deterministic: every (seed, difficulty) pair replays the identical episode, and training seeds never touch held-out seeds. The arena is a gym, not a vibe.',
  },
  {
    n: '02',
    title: 'The sabotage catalog',
    body: '11 CWE patterns × 3 escalation variants = 33 malicious diffs. Each pattern is a small Python function with an honest fix, three malicious versions ordered obvious → subtlest, and an executable check that fails on the malicious one. Ground truth you can run.',
  },
  {
    n: '03',
    title: 'The reward function',
    body: 'R = 0.65·F1 + 0.20·early bonus + 0.10·recall − 0.20·false-positive rate, plus four anti-hack guardrails. Along the way a one-line bug — float(x or 0.0) — silently turned the −0.5 cowardice penalty into 0.0, and the model learned that doing nothing was optimal. The incentives are the product.',
  },
  {
    n: '04',
    title: 'The training',
    body: 'Qwen2.5-1.5B, LoRA r=16, TRL GRPO on a single GPU. Run 1: curriculum d=0.2→0.6 over 96 prompts. Run 2: fixed d=0.4 over 128 prompts as confirmation. No GPT, no Claude, no judge anywhere in the loop.',
  },
]

const WHY = [
  {
    title: 'AI supervising AI, made trainable',
    body: 'It converts a vague safety idea into a measurable, trainable benchmark. As agents ship into real codebases, the gap is not whether one model can solve a task — it is whether a small overseer can catch a peer that is subtly wrong.',
  },
  {
    title: 'Small beats big, nearly',
    body: 'A 1.5B open model reaches 86% of a 70B commercial model\u2019s detection F1 — at 1/47th the parameters, and roughly $0.001 versus $0.50 per thousand decisions. That is a deployable oversight layer, not a research demo.',
  },
]

export default function Home() {
  return (
    <>
      <NavBar />
      <main className="page-enter">
        {/* ── HERO · what the product is ──────────────────────────── */}
        <section style={{ padding: '96px 0 88px' }} id="top">
          <div className="wrap">
            <div className="hero-grid rise">
              <div>
                <p className="readout" style={{ marginBottom: 22 }}>
                  Meta × PyTorch OpenEnv Hackathon 2026
                </p>
                <h1 className="display" style={{ marginBottom: 22, maxWidth: 520 }}>
                  Who watches the agents?
                </h1>
                <p className="lede" style={{ marginBottom: 36 }}>
                  Oversight Arena is a training ground where a small AI overseer learns to
                  catch sabotage hidden in code patches. Three workers submit diffs. Up to
                  two hide vulnerabilities. The overseer learns to flag them — with no
                  bigger judge model in the loop.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <a href="#walkthrough" className="btn btn-primary">
                    Walk through an episode <ArrowRight size={15} />
                  </a>
                  <Link href="/results" className="btn btn-secondary">
                    See the results
                  </Link>
                </div>
              </div>
              <EpisodeBoard />
            </div>
          </div>
        </section>

        <StatusBanner />

        {/* ── WALKTHROUGH · how an episode works ────────────────────── */}
        <section className="section" id="walkthrough" style={{ scrollMarginTop: 70 }}>
          <div className="wrap">
            <Reveal>
              <p className="label" style={{ marginBottom: 8 }}>How an episode works</p>
              <h2 className="h2" style={{ marginBottom: 12, maxWidth: 600 }}>
                Five moves from patch to verdict.
              </h2>
              <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 36, maxWidth: 600 }}>
                Every episode is the same game with different cards. Step through it —
                this is the loop the overseer trained on, thousands of times.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <Walkthrough />
            </Reveal>
          </div>
        </section>

        {/* ── BUILD STORY · what we did, step by step ───────────────── */}
        <section className="section" id="build" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)', scrollMarginTop: 70 }}>
          <div className="wrap">
            <Reveal>
              <p className="label" style={{ marginBottom: 8 }}>What we built</p>
              <h2 className="h2" style={{ marginBottom: 12, maxWidth: 600 }}>
                Four pieces, in order.
              </h2>
              <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 44, maxWidth: 600 }}>
                A benchmark is a promise that the numbers mean something. Each piece
                exists so the next one can be trusted.
              </p>
            </Reveal>
            <div className="timeline">
              {BUILD_STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 60}>
                  <div className="timeline-step">
                    <span className="timeline-dot" />
                    <p className="mono" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>
                      {s.n}
                    </p>
                    <h3 className="h3" style={{ marginBottom: 10 }}>{s.title}</h3>
                    <p style={{ fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 660 }}>
                      {s.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── RESULTS TEASER · the payoff, progressively ────────────── */}
        <section className="section" id="results">
          <div className="wrap">
            <Reveal>
              <p className="label" style={{ marginBottom: 8 }}>The payoff</p>
              <h2 className="h2" style={{ marginBottom: 12, maxWidth: 600 }}>
                Training worked. Here is the headline.
              </h2>
              <p style={{ fontSize: 15, color: 'var(--text-3)', marginBottom: 36, maxWidth: 600 }}>
                The full evidence — both runs, the training curve, the ablations, the
                caveats — lives on the results page, each number labelled with where it
                came from.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <div className="ledger" style={{ marginBottom: 20 }}>
                <div className="ledger-cell">
                  <p className="ledger-value" style={{ color: 'var(--accent)' }}>
                    <CountUp to={0.244} decimals={3} />
                  </p>
                  <p className="ledger-label">Trained F1 · GRPO Run 1</p>
                  <p className="ledger-sub">from 0.189 untrained · documentation-reported</p>
                </div>
                <div className="ledger-cell">
                  <p className="ledger-value" style={{ color: 'var(--green)' }}>
                    <CountUp to={29} prefix="+" suffix="%" />
                  </p>
                  <p className="ledger-label">Relative improvement</p>
                  <p className="ledger-sub">over the untrained baseline</p>
                </div>
                <div className="ledger-cell">
                  <p className="ledger-value">
                    <CountUp to={86} suffix="%" />
                  </p>
                  <p className="ledger-label">Of Groq 70B zero-shot F1</p>
                  <p className="ledger-sub">at 1/47th the parameters</p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <Link href="/results" className="btn btn-secondary">
                Full results with provenance <ArrowUpRight size={14} />
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ── WHY IT MATTERS ────────────────────────────────────────── */}
        <section className="section" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--border)' }}>
          <div className="wrap">
            <Reveal>
              <p className="label" style={{ marginBottom: 8 }}>Why it matters</p>
              <h2 className="h2" style={{ marginBottom: 40, maxWidth: 600 }}>
                The model is not the product. The environment is.
              </h2>
            </Reveal>
            <div className="pipe" style={{ marginBottom: 48 }}>
              {WHY.map((w, i) => (
                <Reveal key={w.title} delay={i * 80}>
                  <div className="pipe-step">
                    <span className="pipe-num">0{i + 1}</span>
                    <h3 className="h3" style={{ marginBottom: 10 }}>{w.title}</h3>
                    <p style={{ fontSize: 14.5, color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 360 }}>
                      {w.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal>
              <blockquote
                style={{
                  borderLeft: '2px solid var(--accent)',
                  paddingLeft: 28,
                  maxWidth: 680,
                }}
              >
                <p style={{ fontSize: 22, lineHeight: 1.5, letterSpacing: '-0.015em', color: 'var(--text-1)', marginBottom: 12 }}>
                  &ldquo;The model is only as good as the incentives you give it.&rdquo;
                </p>
                <cite className="mono" style={{ fontStyle: 'normal', fontSize: 12.5, color: 'var(--text-3)' }}>
                  — Team SAGE, project blog
                </cite>
              </blockquote>
            </Reveal>
          </div>
        </section>

        {/* ── TRY IT ────────────────────────────────────────────────── */}
        <section className="section">
          <div className="wrap">
            <Reveal>
              <div className="panel" style={{ padding: '48px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 28, flexWrap: 'wrap' }}>
                <div style={{ maxWidth: 480 }}>
                  <h2 className="h2" style={{ marginBottom: 10 }}>Run it yourself.</h2>
                  <p style={{ fontSize: 15, color: 'var(--text-3)', lineHeight: 1.65 }}>
                    The environment is live on Hugging Face, the code is on GitHub, and
                    the GRPO training runs in a Colab. Everything is MIT-licensed.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <a href="https://huggingface.co/spaces/anikasoni/oversight_arena" target="_blank" rel="noreferrer" className="btn btn-primary">
                    Open the live Space <ExternalLink size={14} />
                  </a>
                  <a href="https://github.com/Lakshay-2005/oversight-arena" target="_blank" rel="noreferrer" className="btn btn-secondary">
                    GitHub repo
                  </a>
                  <a
                    href="https://colab.research.google.com/github/anikasoni/oversight-arena/blob/main/scripts/train_grpo.ipynb"
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                  >
                    Training Colab
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <footer>
          <div className="wrap footer">
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Oversight Arena — an OpenEnv Hackathon 2026 entry by Team SAGE.
            </p>
            <p className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>
              github.com/Lakshay-2005/oversight-arena
            </p>
          </div>
        </footer>
      </main>
    </>
  )
}
