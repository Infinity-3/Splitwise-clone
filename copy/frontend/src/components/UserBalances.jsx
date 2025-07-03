import React, { useState, useEffect } from 'react';

function UserBalances({ userId }) {
  const [balances, setBalances] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Fetch user balances
        const balancesRes = await fetch(`http://localhost:8000/users/${userId}/balances`);
        if (!balancesRes.ok) throw new Error('Failed to fetch user balances');
        const balancesData = await balancesRes.json();
        setBalances(balancesData);
        
        // Fetch all users for names
        const usersRes = await fetch('http://localhost:8000/users/');
        if (!usersRes.ok) throw new Error('Failed to fetch users');
        const usersData = await usersRes.json();
        
        const usersMap = {};
        usersData.forEach(user => {
          usersMap[user.id] = user.name;
        });
        setUsers(usersMap);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchData();
    }
  }, [userId]);

  if (loading) {
    return <div className="bg-white p-6 rounded-lg shadow-md">Loading...</div>;
  }

  if (error) {
    return <div className="bg-white p-6 rounded-lg shadow-md text-red-500">{error}</div>;
  }

  if (balances.length === 0) {
    return <div className="bg-white p-6 rounded-lg shadow-md">No balances to show</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-medium mb-4">User Balances</h3>
      <ul className="space-y-2">
        {balances.map((balance, index) => (
          <li key={index} className="flex justify-between">
            {balance.user_id === parseInt(userId) ? (
              <span>You owe {users[balance.owes_to]}</span>
            ) : (
              <span>{users[balance.user_id]} owes you</span>
            )}
            <span className={`font-medium ${balance.user_id === parseInt(userId) ? 'text-red-500' : 'text-green-500'}`}>
              ${balance.amount.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UserBalances;