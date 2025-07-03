import React, { useState, useEffect } from 'react';
import styles from './ExpenseForm.module.css';

function ExpenseForm({ groups, onExpenseCreated }) {
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState('equal');
  const [splits, setSplits] = useState([]);
  const [error, setError] = useState('');

  // Get current group members when group selection changes
  useEffect(() => {
    if (selectedGroupId) {
      const group = groups.find(g => g.id === parseInt(selectedGroupId));
      if (group) {
        // Initialize equal splits by default
        setSplits(group.members.map(member => ({
          user_id: member.id,
          name: member.name,
          amount: (splitType === 'equal' ? (amount / group.members.length) : 0)
        })));
      }
    }
  }, [selectedGroupId, splitType, amount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedGroupId || !description || !amount || !paidBy) {
      setError('All fields are required');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/groups/${selectedGroupId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount: parseFloat(amount),
          paid_by: parseInt(paidBy),
          split_type: splitType,
          splits: splits.map(split => ({
            user_id: split.user_id,
            amount: split.amount,
            percentage: split.percentage
          }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create expense');
      }

      onExpenseCreated();
      // Reset form
      setSelectedGroupId('');
      setDescription('');
      setAmount('');
      setPaidBy('');
      setSplitType('equal');
      setSplits([]);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSplitChange = (index, field, value) => {
    const updatedSplits = [...splits];
    updatedSplits[index][field] = parseFloat(value) || 0;
    setSplits(updatedSplits);
  };

  return (
    <div className={styles.expenseFormContainer}>
      <h2>Add Expense</h2>
      {error && <div className={styles.error}>{error}</div>}
      
      <form onSubmit={handleSubmit}>
        {/* Group Selection */}
        <div className={styles.formGroup}>
          <label>Group</label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            required
          >
            <option value="">Select a group</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>

        {/* Expense Details */}
        <div className={styles.formGroup}>
          <label>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label>Amount</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        {/* Paid By Selection */}
        {selectedGroupId && (
          <div className={styles.formGroup}>
            <label>Paid By</label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              required
            >
              <option value="">Select member</option>
              {groups.find(g => g.id === parseInt(selectedGroupId))?.members.map(member => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Split Type */}
        <div className={styles.formGroup}>
          <label>Split Type</label>
          <select
            value={splitType}
            onChange={(e) => setSplitType(e.target.value)}
          >
            <option value="equal">Equal</option>
            <option value="percentage">Percentage</option>
            <option value="exact">Exact Amount</option>
          </select>
        </div>

        {/* Split Details */}
        {selectedGroupId && splits.length > 0 && (
          <div className={styles.splitsContainer}>
            <h3>Split Details</h3>
            {splits.map((split, index) => (
              <div key={split.user_id} className={styles.splitRow}>
                <span>{split.name}</span>
                {splitType === 'percentage' && (
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={split.percentage || ''}
                    onChange={(e) => handleSplitChange(index, 'percentage', e.target.value)}
                    required={splitType === 'percentage'}
                  />
                )}
                {splitType === 'exact' && (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={split.amount || ''}
                    onChange={(e) => handleSplitChange(index, 'amount', e.target.value)}
                    required={splitType === 'exact'}
                  />
                )}
                {splitType === 'equal' && (
                  <span>{(amount / splits.length).toFixed(2)}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <button type="submit">Add Expense</button>
      </form>
    </div>
  );
}

export default ExpenseForm;