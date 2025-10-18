import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
// Simple SVG icons as fallback
const CheckCircleIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XMarkIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const BetSuccessModal = ({ isOpen, onClose, transactionHash, betAmount, betOption }) => {
  const navigate = useNavigate();

  const handleViewBets = () => {
    navigate('/profile');
    onClose();
  };

  const handleViewTransaction = () => {
    if (transactionHash) {
      window.open(`https://sepolia.etherscan.io/tx/${transactionHash}`, '_blank');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
              onClick={onClose}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative transform overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-green-500/20 shadow-2xl shadow-green-500/10 px-6 pb-6 pt-8 text-left transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-8"
            >
              {/* Success Icon with Animation */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/50"
              >
                <CheckCircleIcon className="h-12 w-12 text-white" />
              </motion.div>

              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center mb-6"
              >
                <h3 className="text-2xl font-bold text-white mb-2">
                  Bet Placed Successfully!
                </h3>
                <p className="text-gray-400 text-sm">
                  Your encrypted bet has been confirmed on-chain
                </p>
              </motion.div>

              {/* Bet Details Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mb-6 space-y-3"
              >
                <div className="rounded-2xl bg-gradient-to-br from-gray-800/80 to-gray-900/80 p-5 border border-gray-700/50 backdrop-blur-sm">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Amount</span>
                      <span className="text-white font-bold text-lg">{betAmount} USDC</span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Your Choice</span>
                      <span className="text-white font-semibold">{betOption}</span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Privacy</span>
                      <span className="inline-flex items-center gap-2 text-green-400 font-medium text-sm">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        Fully Encrypted
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transaction Hash */}
                {transactionHash && (
                  <button
                    onClick={handleViewTransaction}
                    className="w-full text-center p-3 rounded-xl bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800 hover:border-blue-500/50 transition-all group"
                  >
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-400 group-hover:text-blue-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span className="truncate max-w-[200px]">{transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}</span>
                    </div>
                  </button>
                )}
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col gap-3"
              >
                <button
                  type="button"
                  className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 transition-all duration-200"
                  onClick={onClose}
                >
                  Place Another Bet
                </button>

                <button
                  type="button"
                  className="w-full rounded-xl bg-gray-800 border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 hover:bg-gray-700 hover:border-gray-600 transition-all"
                  onClick={handleViewBets}
                >
                  View Your Bets
                </button>
              </motion.div>

              {/* Close Button */}
              <button
                type="button"
                className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                onClick={onClose}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BetSuccessModal;