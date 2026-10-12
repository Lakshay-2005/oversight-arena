import { REVIEWER_PROFILES } from '@/lib/transform'

/** Standing disclosure wherever the heuristic reviewer panel's output is shown. */
export default function ScriptedPanelNote() {
  return (
    <div className="note-box">
      <strong>Scripted panel, not AI models.</strong> The {REVIEWER_PROFILES.length} reviewers ({REVIEWER_PROFILES.map((p) => p.profile).join(' / ')}) are
      keyword rules written for a few of the 11 catalog patterns, running in your browser on the patch text. They are not the trained
      Qwen overseer and make no model calls. They never see the environment&apos;s ground truth; the backend grades their decision afterwards,
      so misses and false positives are expected and shown.
    </div>
  )
}
