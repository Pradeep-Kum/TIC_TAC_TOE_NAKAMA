export function AuthScreen({
  authMode,
  authUsername,
  authPassword,
  authError,
  onSwitchMode,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}) {
  return (
    <section className="auth-screen">
      <div className="panel auth-panel">
        <div className="tab-row">
          <button className={authMode === "login" ? "tab-button is-active" : "tab-button"} onClick={() => onSwitchMode("login")}>
            Login
          </button>
          <button className={authMode === "signup" ? "tab-button is-active" : "tab-button"} onClick={() => onSwitchMode("signup")}>
            Sign Up
          </button>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <input
            value={authUsername}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="text-input"
          />
          <input
            value={authPassword}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Password"
            type="password"
            autoComplete={authMode === "signup" ? "new-password" : "current-password"}
            className="text-input"
          />
          {authError ? <p className="error-text">{authError}</p> : null}
          <p className="helper-text">
            Username must be unique and use 3-20 lowercase letters, numbers, or underscores. Passwords must be at least 8 characters.
          </p>
          <button className="primary-button" type="submit">
            {authMode === "signup" ? "Create Account" : "Log In"}
          </button>
        </form>
      </div>
    </section>
  );
}
