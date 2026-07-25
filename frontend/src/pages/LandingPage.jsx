/** First screen. Title + one-sentence pitch + a way into the two working pages.
 *  No care recipient details here — those appear once a working page is open.
 *  `leaving` plays the fade-out; App waits for onLeft before swapping the page in. */
export default function LandingPage({ onOpen, leaving = false, onLeft }) {
  return (
    <div
      className={`landing ${leaving ? 'is-leaving' : ''}`.trim()}
      // Children animate too; only the wrapper's own fade-out means "done".
      onAnimationEnd={(e) => {
        if (leaving && e.target === e.currentTarget) onLeft?.();
      }}
    >
      <div className="landing__inner">
        <span className="landing__mark" aria-hidden="true">
          ⟳
        </span>

        <h1 className="landing__title">CareRelay</h1>

        <p className="landing__pitch">
          CareRelay turns fragmented caregiver updates into one shared care timeline and
          automatically generates a clear, traceable handoff summary for the next caregiver.
        </p>

        <div className="landing__actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={() => onOpen('chat')}>
            Record an update
          </button>
          <button type="button" className="btn btn--lg" onClick={() => onOpen('board')}>
            Open the care board
          </button>
        </div>
      </div>
    </div>
  );
}
