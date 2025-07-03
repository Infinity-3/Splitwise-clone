import React, { useState, useEffect } from 'react';
import styles from './GroupBalance.module.css';

function GroupBalance({ groupId }) {
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const [groupRes, expensesRes] = await Promise.all([
          fetch(`http://localhost:8000/groups/${groupId}`),
          fetch(`http://localhost:8000/groups/${groupId}/expenses`)
        ]);

        if (!groupRes.ok) throw new Error('Failed to fetch group');
        if (!expensesRes.ok) throw new Error('Failed to fetch expenses');

        const [groupData, expensesData] = await Promise.all([
          groupRes.json(),
          expensesRes.json()
        ]);

        setGroup(groupData);
        setExpenses(expensesData);
      } catch (err) {
        setError(err.message);
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (groupId) {
      fetchData();
    }
  }, [groupId]);

  const calculateBalances = () => {
    if (!group || !expenses) return { memberSpending: {}, totalGroupBalance: 0 };

    const memberSpending = {};
    const totalGroupBalance = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Initialize members with detailed tracking
    group.members.forEach(member => {
      memberSpending[member.id] = {
        name: member.name,
        paid: 0,
        owesTo: {}, // Tracks who owes what to this member
        owedBy: {}, // Tracks who this member owes
        getBack: 0, // Total amount this member should get back
        shouldPay: 0 // Total amount this member should pay
      };
    });

    // Process each expense
    expenses.forEach(expense => {
      if (expense.paid_by && expense.paid_by.id) {
        const payerId = expense.paid_by.id;
        memberSpending[payerId].paid += expense.amount;

        // Process each split
        expense.splits.forEach(split => {
          if (split.user_id !== payerId) {
            const debtorId = split.user_id;
            const amount = split.amount || expense.amount / (expense.splits.length || group.members.length - 1);

            // Track what the debtor owes to the payer
            memberSpending[debtorId].owesTo[payerId] = 
              (memberSpending[debtorId].owesTo[payerId] || 0) + amount;
            
            // Track what the payer is owed by the debtor
            memberSpending[payerId].owedBy[debtorId] = 
              (memberSpending[payerId].owedBy[debtorId] || 0) + amount;
          }
        });
      }
    });

    // Calculate net amounts
    group.members.forEach(member => {
      const memberData = memberSpending[member.id];
      
      // Calculate total amount this member should get back
      memberData.getBack = Object.values(memberData.owedBy).reduce((sum, amount) => sum + amount, 0);
      
      // Calculate total amount this member should pay
      memberData.shouldPay = Object.values(memberData.owesTo).reduce((sum, amount) => sum + amount, 0);
    });

    return { memberSpending, totalGroupBalance };
  };

  const simplifyBalances = (memberSpending) => {
    if (!group || !memberSpending) return [];

    const creditors = [];
    const debtors = [];
    
    // Categorize members based on net balance
    group.members.forEach(member => {
      const net = memberSpending[member.id].getBack - memberSpending[member.id].shouldPay;
      if (net > 0.01) {
        creditors.push({ 
          id: member.id, 
          amount: net,
          details: memberSpending[member.id].owedBy
        });
      } else if (net < -0.01) {
        debtors.push({ 
          id: member.id, 
          amount: -net,
          details: memberSpending[member.id].owesTo
        });
      }
    });

    // Sort by amount (highest first)
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const simplified = [];
    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];
      
      // Check if debtor owes this specific creditor
      const owesAmount = debtor.details[creditor.id] || 0;
      const amount = Math.min(creditor.amount, debtor.amount, owesAmount);
      
      if (amount > 0.01) {
        simplified.push({
          from: debtor.id,
          to: creditor.id,
          amount: parseFloat(amount.toFixed(2))
        });

        creditor.amount -= amount;
        debtor.amount -= amount;
      }

      if (creditor.amount < 0.01) creditorIndex++;
      if (debtor.amount < 0.01) debtorIndex++;
    }

    return simplified;
  };

  if (loading) return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner}></div>
      <p>Loading group data...</p>
    </div>
  );

  if (error) return (
    <div className={styles.errorContainer}>
      <h3>Error Loading Group</h3>
      <p>{error}</p>
      <button onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  if (!group) return (
    <div className={styles.notFound}>
      <h3>Group Not Found</h3>
      <p>The requested group could not be loaded.</p>
    </div>
  );

  const { memberSpending, totalGroupBalance } = calculateBalances();
  const simplifiedBalances = simplifyBalances(memberSpending);

  return (
    <div className={styles.groupBalanceContainer}>
      <header className={styles.header}>
        <h2>{group.name} - Balance Summary</h2>
        <p className={styles.totalBalance}>
          Total Group Expenses: ₹{totalGroupBalance.toFixed(2)}
        </p>
      </header>

      <section className={styles.section}>
        <h3>Member Spending Overview</h3>
        <div className={styles.tableWrapper}>
          <table className={styles.balanceTable}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Paid</th>
                <th>Owes</th>
                <th>Net Balance</th>
              </tr>
            </thead>
            <tbody>
              {group.members.map(member => {
                const spending = memberSpending[member.id];
                const net = spending.getBack - spending.shouldPay;
                return (
                  <tr key={member.id} className={styles.memberRow}>
                    <td>{member.name}</td>
                    <td>₹{spending.paid.toFixed(2)}</td>
                    <td>₹{spending.shouldPay.toFixed(2)}</td>
                    <td className={
                      net > 0.01 ? styles.positiveBalance :
                      net < -0.01 ? styles.negativeBalance : styles.zeroBalance
                    }>
                      ₹{Math.abs(net).toFixed(2)}
                      <span className={styles.balanceLabel}>
                        {net > 0.01 ? ' (gets back)' : 
                         net < -0.01 ? ' (owes)' : ' (settled)'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <h3>Simplified Balances</h3>
        {simplifiedBalances.length > 0 ? (
          <div className={styles.tableWrapper}>
            <table className={styles.detailedBalanceTable}>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {simplifiedBalances.map((balance, index) => {
                  const fromMember = group.members.find(m => m.id === balance.from);
                  const toMember = group.members.find(m => m.id === balance.to);
                  return (
                    <tr key={index}>
                      <td>{fromMember?.name || 'Unknown'}</td>
                      <td>{toMember?.name || 'Unknown'}</td>
                      <td>₹{balance.amount.toFixed(2)}</td>
                      <td className={styles.statusCell}>
                        <span className={styles.pendingBadge}>Pending</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.noBalances}>All balances are settled</p>
        )}
      </section>
    </div>
  );
}

export default GroupBalance;