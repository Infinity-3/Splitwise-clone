import React, { useEffect, useState } from 'react';

function GroupBalance({ groupId }) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/groups/${groupId}/balance`);
        if (!response.ok) throw new Error('Failed to fetch balance');
        const data = await response.json();
        setBalance(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [groupId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!balance) return <div>No balance data</div>;

  return (
    <div>
      <h2>Group Balance</h2>
      <p>Total Spent: ${balance.total_spent.toFixed(2)}</p>
      <p>Remaining Budget: ${balance.remaining_budget.toFixed(2)}</p>
      {balance.budget_exceeded && (
        <p style={{ color: 'red' }}>Budget exceeded!</p>
      )}

      <h3>Highest Spenders</h3>
      <ul>
        {balance.highest_spenders.map((spender, index) => (
          <li key={index}>
            {spender.name}: ${spender.amount.toFixed(2)}
          </li>
        ))}
      </ul>

      <h3>Balances</h3>
      <ul>
        {balance.balances.map((item, index) => {
          const debtor = balance.members.find(m => m.id === item.user_id);
          const creditor = balance.members.find(m => m.id === item.owes_to);
          return (
            <li key={index}>
              {debtor.name} owes {creditor.name}: ${item.amount.toFixed(2)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default GroupBalance;
