import React, { useState, useEffect } from 'react';
import { useWallet } from '../../hooks/useWallet';
import { getNetworkConfig, getContracts } from '../../config/contracts';
import { contractService } from '../../services/contractService';

const ContractDashboard = () => {
    const { account, chainId, provider } = useWallet();
    const [networkInfo, setNetworkInfo] = useState(null);
    const [contracts, setContracts] = useState(null);
    const [bets, setBets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (chainId && provider) {
            loadContractInfo();
        }
    }, [chainId, provider]);

    const loadContractInfo = async () => {
        try {
            setLoading(true);
            setError(null);

            console.log('🔧 Dashboard using wallet chainId:', chainId);

            // Get network and contract info
            const network = getNetworkConfig(chainId);
            const contractAddresses = getContracts(chainId);

            setNetworkInfo(network);
            setContracts(contractAddresses);

            // Load bets from contract
            await contractService.initializeReadOnly(chainId, contractAddresses);
            const allBets = await contractService.getAllBets();
            setBets(allBets);

        } catch (err) {
            console.error('Error loading contract info:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatAddress = (address) => {
        if (!address) return 'N/A';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // You could add a toast notification here
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    <strong className="font-bold">Error:</strong>
                    <span className="block sm:inline"> {error}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Contract Dashboard</h1>
                <p className="text-gray-600">Monitor your FHEVM Polymarket contracts and bets</p>
            </div>

            {/* Network Info */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                    <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                    Network Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Network</label>
                        <p className="text-lg font-semibold text-blue-600">{networkInfo?.name || 'Unknown'}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Chain ID</label>
                        <p className="text-lg font-semibold">{networkInfo?.chainId || 'N/A'}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">RPC URL</label>
                        <p className="text-sm text-gray-600">{networkInfo?.rpcUrl || 'N/A'}</p>
                    </div>
                </div>
            </div>

            {/* Contract Addresses */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                    <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                    Contract Addresses
                </h2>
                <div className="space-y-3">
                    {contracts && Object.entries(contracts).map(([name, address]) => (
                        <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{name}</label>
                                <p className="text-sm text-gray-600">{formatAddress(address)}</p>
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => copyToClipboard(address)}
                                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                                >
                                    Copy
                                </button>
                                <a
                                    href={networkInfo?.blockExplorerUrl ? `${networkInfo.blockExplorerUrl}/address/${address}` : '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors disabled:opacity-50"
                                >
                                    Explorer
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bet Statistics */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                    <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
                    Bet Statistics
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">{bets.length}</p>
                        <p className="text-sm text-gray-600">Total Bets</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">
                            {bets.filter(bet => bet.status === 'active').length}
                        </p>
                        <p className="text-sm text-gray-600">Active Bets</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <p className="text-2xl font-bold text-yellow-600">
                            {bets.filter(bet => bet.status === 'ended').length}
                        </p>
                        <p className="text-sm text-gray-600">Ended Bets</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-600">
                            {bets.filter(bet => bet.status === 'resolved').length}
                        </p>
                        <p className="text-sm text-gray-600">Resolved Bets</p>
                    </div>
                </div>
            </div>

            {/* Bet List */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                    <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
                    All Bets ({bets.length})
                </h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full table-auto">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">ID</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Title</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Options</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">End Time</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bets.map((bet) => (
                                <tr key={bet.id} className="border-t hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">#{bet.id}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900">
                                        <div className="max-w-xs truncate" title={bet.title}>
                                            {bet.title}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{bet.optionCount}</td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {new Date(bet.endTime * 1000).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                            bet.status === 'active' ? 'bg-green-100 text-green-800' :
                                            bet.status === 'ended' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {bet.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <a
                                            href={`/bet/${bet.id}`}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            View
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Refresh Button */}
            <div className="mt-6 text-center">
                <button
                    onClick={loadContractInfo}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Refreshing...' : 'Refresh Data'}
                </button>
            </div>
        </div>
    );
};

export default ContractDashboard;