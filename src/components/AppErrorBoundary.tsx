import React from 'react';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="grid min-h-screen place-items-center bg-[#f2f5ed] p-5 text-[#173d2c]">
          <section className="w-full max-w-lg rounded-[24px] border border-[#d9e3d7] bg-white p-6 shadow-sm">
            <h1 className="font-serif text-2xl font-semibold">Pagina nu s-a putut încărca</h1>
            <p className="mt-2 text-sm leading-6 text-[#74837b]">A apărut o eroare în aplicație. Reîncarcă pagina. Dacă mesajul revine, trimite o captură administratorului.</p>
            <pre className="mt-4 overflow-auto rounded-xl bg-[#f6f7f0] p-3 text-xs text-red-700">{this.state.error.message}</pre>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-[#173d2c] px-4 py-2 text-sm font-semibold text-white">Reîncarcă pagina</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
