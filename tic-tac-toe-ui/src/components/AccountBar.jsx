export function AccountBar({ accountUsername, onLogout }) {
  return (
    <div className="account-bar">
      <span>
        Signed in as <strong>{accountUsername}</strong>
      </span>
      <button className="ghost-button" onClick={onLogout}>
        Log Out
      </button>
    </div>
  );
}
