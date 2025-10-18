import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { WalletProvider } from './hooks/useWallet.jsx';

// Components
import Header from './components/common/Header';
import Footer from './components/common/Footer';

// Pages
import Home from './pages/Home';
import BetDetail from './pages/BetDetail';
import Category from './pages/Category';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Wallet from './pages/Wallet';
import Claims from './pages/Claims';
import Dashboard from './pages/Dashboard';
import Testfhevm from '@pages/Testfhevm';
import ContractDashboard from './components/admin/ContractDashboard';

// Styles
import './styles/globals.css';

// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5 minutes
        },
    },
});

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <WalletProvider>
                <Router>
                    <div className="min-h-screen site-background flex flex-col">
                        <Header />

                        <main className="flex-1">
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/test" element={<Testfhevm />} />
                                <Route path="/testfhevm" element={<Testfhevm />} />
                                <Route path="/dashboard" element={<Dashboard />} />
                                <Route path="/contract-dashboard" element={<ContractDashboard />} />
                                <Route path="/bet/:betId" element={<BetDetail />} />
                                <Route path="/category/:categoryId" element={<Category />} />
                                <Route path="/profile" element={<Profile />} />
                                <Route path="/wallet" element={<Wallet />} />
                                <Route path="/claims" element={<Claims />} />
                                <Route path="/admin/*" element={<Admin />} />


                                {/* Catch all route - 404 */}
                                <Route path="*" element={<NotFound />} />
                            </Routes>
                        </main>

                        <Footer />

                        {/* Toast notifications */}
                        <Toaster
                            position="top-right"
                            toastOptions={{
                                duration: 4000,
                                style: {
                                    background: 'var(--toast-bg)',
                                    color: 'var(--toast-color)',
                                    border: '1px solid var(--toast-border)',
                                },
                                success: {
                                    duration: 3000,
                                    iconTheme: {
                                        primary: '#10B981',
                                        secondary: '#FFFFFF',
                                    },
                                },
                                error: {
                                    duration: 5000,
                                    iconTheme: {
                                        primary: '#EF4444',
                                        secondary: '#FFFFFF',
                                    },
                                },
                            }}
                        />
                    </div>
                </Router>
            </WalletProvider>
        </QueryClientProvider>
    );
}

// 404 Not Found component
const NotFound = () => (
    <div className="min-h-screen flex items-center justify-center site-background">
        <div className="text-center">
            <div className="text-6xl font-bold text-gray-300 dark:text-gray-700 mb-4">
                404
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Page Not Found
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
                The page you're looking for doesn't exist or has been moved.
            </p>
            <button
                onClick={() => window.history.back()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
                Go Back
            </button>
        </div>
    </div>
);

// Add ZAMA.ai theme classes to HTML
document.documentElement.classList.add('theme-gradient', 'dark');

ReactDOM.createRoot(document.getElementById('root')).render(<App />);