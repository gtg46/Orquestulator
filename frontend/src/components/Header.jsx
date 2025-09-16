function Header() {
    return (
        <header className="app-header">
            <h1>
                <span className="header-icon">
                    <img src="/favicon.svg" alt="Orquestulator" style={{ width: 28, height: 28, verticalAlign: 'middle' }} />
                </span>
                Orquestulator
            </h1>
            <p>Query evaluation tool for Orquesta, YAQL, and Jinja2</p>
        </header>
    )
}

export default Header
