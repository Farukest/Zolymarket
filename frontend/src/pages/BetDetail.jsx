import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BetDetail_Component from '../components/bet/BetDetail';

const BetDetail = () => {
  const { betId } = useParams();
  const navigate = useNavigate();

  if (!betId) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 text-gray-600 hover:text-gray-900 font-medium"
        >
          ← Back to Bets
        </button>

        <BetDetail_Component betId={betId} />
      </div>
    </div>
  );
};

export default BetDetail;