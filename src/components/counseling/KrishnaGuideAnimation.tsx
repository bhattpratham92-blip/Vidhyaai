import { Sparkles } from 'lucide-react';

/** A respectful, lightweight welcome illustration for Bhagavad Gita mode. */
export function KrishnaGuideAnimation() {
  return (
    <div className="gita-guide" aria-hidden="true">
      <Sparkles className="gita-sparkle gita-sparkle-one" size={13} />
      <Sparkles className="gita-sparkle gita-sparkle-two" size={10} />
      <div className="gita-halo" />
      <div className="gita-feather-mark">
        <span className="gita-feather-eye" />
      </div>
      <div className="gita-avatar">
        <span className="gita-crown" />
        <span className="gita-face" />
        <span className="gita-flute" />
      </div>
    </div>
  );
}

export function KrishnaArrivalAnimation() {
  return (
    <div className="gita-krishna-arrival" aria-hidden="true">
      <span className="gita-arrival-halo gita-arrival-halo-one" />
      <span className="gita-arrival-halo gita-arrival-halo-two" />
      <div className="gita-arrival-feather"><span /></div>
      <div className="gita-arrival-crown" />
      <div className="gita-arrival-head">
        <span className="gita-arrival-hair" />
        <span className="gita-arrival-eyes" />
        <span className="gita-arrival-smile" />
      </div>
      <div className="gita-arrival-body">
        <span className="gita-arrival-sash" />
        <span className="gita-arrival-flute" />
      </div>
    </div>
  );
}
