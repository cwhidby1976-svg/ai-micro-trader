import React from 'react';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export interface DisclaimerSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  closing?: string;
  emphasis?: string;
}

export const DISCLAIMER_SECTIONS: DisclaimerSection[] = [
  {
    id: 'general',
    title: '1. General Information',
    paragraphs: [
      'AI Micro Trader is a software application designed to provide cryptocurrency market monitoring, token discovery, technical analysis, trading signals, and manual and automated trading tools.',
      'The platform is intended to assist users in evaluating potential opportunities within the cryptocurrency market, particularly tokens operating on the Solana blockchain.',
      'AI Micro Trader is a technology and trading-support platform. It does not guarantee investment returns, trading success, or financial profits.',
    ],
  },
  {
    id: 'risk',
    title: '2. Cryptocurrency Trading Involves Significant Risk',
    paragraphs: [
      'Cryptocurrency markets are highly volatile and unpredictable. Token prices can rise or fall rapidly, sometimes resulting in substantial or total loss of invested capital.',
      'Users should understand that:',
    ],
    bullets: [
      'Trading cryptocurrency involves the risk of losing money.',
      'Past performance does not guarantee future results.',
      'Trading signals and market analysis may be inaccurate.',
      'Low-liquidity and newly launched tokens may present additional risks.',
      'Market manipulation, scams, liquidity withdrawals, and smart-contract vulnerabilities can result in losses.',
      'Network congestion, transaction fees, slippage, and technical failures may affect trading outcomes.',
    ],
    emphasis: 'Never trade with money you cannot afford to lose.',
  },
  {
    id: 'ai',
    title: '3. AI-Powered Analysis and Automated Trading',
    paragraphs: [
      'AI Micro Trader incorporates market-scanning technology, an eight-point ICC strategy framework, and trading automation capabilities.',
      'These tools are designed to identify and evaluate potential trading opportunities based on configured conditions.',
      'However, no algorithm, artificial intelligence system, or trading strategy can predict market movements with certainty.',
      'Enabling automated trading may result in transactions being initiated and managed according to the user\'s configured settings and authorizations, without requiring approval of every individual trade.',
      'Users are responsible for understanding their selected trading mode, monitoring their accounts, and configuring appropriate risk limits.',
    ],
  },
  {
    id: 'modes',
    title: '4. Manual Trading and Autopilot',
    paragraphs: [
      'AI Micro Trader offers manual trading and automated trading functionality.',
      'Manual Trading: Users review potential opportunities and decide whether to authorize transactions.',
      'Autopilot Trading: When available and explicitly enabled, the application may identify, initiate, and manage eligible trades according to its configured trading rules and risk controls.',
      'Autopilot does not guarantee profitable transactions or prevent losses.',
      'Stop-loss, take-profit, and other risk-management mechanisms may fail to execute at intended prices because of volatility, slippage, liquidity conditions, network delays, or technical issues.',
    ],
  },
  {
    id: 'wallet',
    title: '5. Wallet Ownership and Control',
    paragraphs: [
      'AI Micro Trader is designed to connect with supported third-party cryptocurrency wallets, including Phantom and SafePal.',
      'Users remain responsible for safeguarding their wallets, recovery phrases, private keys, and transaction authorizations.',
      'AI Micro Trader should never require users to disclose their wallet recovery phrase or private key.',
      'Connecting a wallet does not eliminate the risks of cryptocurrency trading or blockchain transactions.',
      'Users should independently review wallet permissions and transaction requests before authorizing them.',
    ],
  },
  {
    id: 'paper',
    title: '6. Paper Trading and Demonstration Accounts',
    paragraphs: [
      'AI Micro Trader may provide paper trading and demonstration functionality using simulated balances, orders, and trading results.',
      'Demo balances and simulated profits are not real funds or withdrawable earnings.',
      'Paper trading performance may differ significantly from actual live trading because of market conditions, slippage, execution delays, liquidity, and transaction costs.',
      'A successful simulated trade does not guarantee that the same result can be achieved in a live account.',
    ],
  },
  {
    id: 'allocation',
    title: '7. Trading Allocation and Risk Management',
    paragraphs: [
      'AI Micro Trader may provide a trading allocation model that separates funds designated for trading from funds designated as a reserve.',
      'For example, a 50% trading allocation and 50% reserve may be used to limit the amount allocated to new trading positions.',
      'This allocation model does not guarantee capital preservation or prevent financial losses.',
      'Users remain responsible for managing their funds and understanding the risks of every transaction.',
    ],
  },
  {
    id: 'third-party',
    title: '8. Third-Party Services and Technical Risks',
    paragraphs: [
      'AI Micro Trader may rely on third-party services, including Solana network infrastructure, Jupiter, wallet providers, market-data services, and token-security analysis providers.',
      'These services may experience outages, inaccurate data, delays, interrupted connectivity, or changes to their functionality.',
      'AI Micro Trader cannot guarantee uninterrupted operation, accurate market data at all times, or successful execution of every requested transaction.',
      'Third-party security assessments do not guarantee that a token is safe or free from fraud.',
    ],
  },
  {
    id: 'advice',
    title: '9. No Financial or Investment Advice',
    paragraphs: [
      'Information provided through AI Micro Trader, NextGen Traders Hub, or associated educational resources is intended for general informational and educational purposes.',
      'It should not be interpreted as personalized financial, investment, legal, or tax advice.',
      'AI Micro Trader does not assess each user\'s financial circumstances, investment objectives, or risk tolerance.',
      'Users should conduct their own research and consult qualified independent professionals when appropriate.',
    ],
  },
  {
    id: 'earnings',
    title: '10. No Guaranteed Earnings',
    paragraphs: [
      'AI Micro Trader and NextGen Traders Hub do not promise or guarantee:',
    ],
    bullets: [
      'Daily, weekly, or monthly profits.',
      'Specific investment returns.',
      'Guaranteed winning trades.',
      'Financial independence or passive income.',
      'Recovery of trading losses.',
      'Protection against cryptocurrency market declines.',
    ],
    closing:
      'Any examples, projections, screenshots, or simulated trading results are illustrative only unless explicitly identified and substantiated as actual historical results.',
  },
  {
    id: 'responsibility',
    title: '11. User Responsibility',
    paragraphs: [
      'By choosing to use AI Micro Trader, users acknowledge that cryptocurrency trading involves financial risk.',
      'Users are responsible for reviewing the platform\'s features, understanding the trading modes they enable, protecting their accounts, complying with applicable laws, and making their own trading decisions.',
      'Nothing in this disclaimer is intended to waive rights or responsibilities that cannot legally be waived.',
    ],
  },
  {
    id: 'final',
    title: '12. Important Final Notice',
    paragraphs: [
      'AI Micro Trader is a trading technology platform—not a guarantee of financial success.',
      'Our objective is to provide users with tools for market research, opportunity identification, strategy evaluation, and trade management.',
      'Every trading decision involves risk, and losses are possible even when risk-management features are enabled.',
    ],
    emphasis: 'Trade responsibly. Understand the risks. Stay in control of your decisions.',
  },
];

export function navigatePublicPath(path: string) {
  if (typeof window === 'undefined') return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function isPublicDisclaimerPath(pathname?: string, hash?: string): boolean {
  const path = (pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/'))
    .replace(/\/+$/, '')
    .toLowerCase();
  const h = (hash ?? (typeof window !== 'undefined' ? window.location.hash : '')).toLowerCase();
  return path === '/disclaimer' || h === '#disclaimer';
}

export const RiskDisclaimer: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      <header className="sticky top-0 z-40 bg-[#080b11]/95 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-8 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={`${import.meta.env.BASE_URL}ai-micro-trader-icon-1024.png`}
              alt="AI Micro Trader official logo"
              className="w-10 h-10 rounded-full object-cover object-center shrink-0"
            />
            <div className="min-w-0">
              <div className="font-extrabold text-sm sm:text-base tracking-wider text-white">AI MICRO TRADER</div>
              <div className="text-[11px] font-medium text-emerald-400 tracking-wide">Powered by NextGen Traders Hub</div>
            </div>
          </div>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigatePublicPath('/');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border border-cyan-500/40 text-xs font-bold shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </a>
        </div>
      </header>

      <main className="flex-1 px-4 lg:px-8 py-10">
        <article className="max-w-4xl mx-auto">
          <div className="mb-8 p-5 sm:p-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-zinc-900 via-[#080b12] to-cyan-950/20">
            <div className="flex items-center gap-2 text-emerald-400 mb-3">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-xs font-bold tracking-widest uppercase">Public disclosure</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide">AI MICRO TRADER</h1>
            <h2 className="mt-2 text-lg sm:text-xl font-semibold text-cyan-300">
              Trading Risk Disclaimer &amp; Important Disclosures
            </h2>
            <p className="mt-3 text-sm text-emerald-400">Powered by NextGen Traders Hub</p>
            <p className="mt-4 text-sm sm:text-base text-zinc-300 leading-relaxed">
              Please read this disclaimer carefully before using AI Micro Trader.
            </p>
          </div>

          <div className="space-y-6">
            {DISCLAIMER_SECTIONS.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6"
              >
                <h3 className="text-base sm:text-lg font-bold text-white border-l-2 border-emerald-400 pl-3 mb-4">
                  {section.title}
                </h3>
                <div className="space-y-3 text-sm sm:text-[15px] leading-relaxed text-zinc-300">
                  {section.paragraphs.map((p) => (
                    <p key={p.slice(0, 48)}>{p}</p>
                  ))}
                  {section.bullets && (
                    <ul className="list-disc pl-5 space-y-2 text-zinc-300">
                      {section.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {section.closing && <p>{section.closing}</p>}
                  {section.emphasis && (
                    <p className="font-semibold text-emerald-300">{section.emphasis}</p>
                  )}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-8 text-center space-y-3">
            <p className="text-sm font-semibold text-white">AI Micro Trader — Powered by NextGen Traders Hub</p>
            <p className="text-xs text-zinc-500 italic leading-relaxed max-w-2xl mx-auto">
              This disclaimer should be reviewed by qualified legal counsel before publication to ensure it
              accurately reflects the platform&apos;s operations, applicable laws, and required disclosures.
            </p>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigatePublicPath('/');
              }}
              className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-black text-xs font-extrabold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Home
            </a>
          </div>
        </article>
      </main>

      <footer className="border-t border-zinc-800/80 bg-[#06080d] px-4 lg:px-8 py-8 text-xs text-zinc-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-bold text-zinc-300">AI MICRO TRADER</span>
          <div className="flex items-center gap-4">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigatePublicPath('/');
              }}
              className="text-zinc-400 hover:text-white transition"
            >
              Home
            </a>
            <a href="/disclaimer" className="text-cyan-400 hover:text-cyan-300 font-semibold transition">
              Risk Disclaimer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
