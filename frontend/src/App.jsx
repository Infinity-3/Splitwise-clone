import React, { useState, useEffect } from 'react';
import GroupForm from './components/GroupForm';
import ExpenseForm from './components/ExpenseForm';
import GroupBalance from './components/GroupBalance';
import UserBalances from './components/UserBalances';

function App() {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://backend:8000';

  useEffect(() => {
    // Fetch initial data
    fetch(`${backendUrl}/users/`)
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error("Error fetching users:", err));

    fetch(`${backendUrl}/groups/`)
      .then(res => res.json())
      .then(data => setGroups(data))
      .catch(err => console.error("Error fetching groups:", err));
  }, []);

  const handleGroupCreated = (newGroup) => {
    setGroups([...groups, newGroup]);
  };

  const handleExpenseCreated = () => {
    // Refresh group expenses and balances
    if (selectedGroup) {
      fetch(`http://localhost:8000/groups/${selectedGroup}`)
        .then(res => res.json())
        .then(data => {
          setGroups(groups.map(g => g.id === data.id ? data : g));
        });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Splitwise Clone</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-8">
          <GroupForm users={users} onGroupCreated={handleGroupCreated} />
          <ExpenseForm 
            groups={groups} 
            users={users} 
            onExpenseCreated={handleExpenseCreated} 
          />
        </div>
        
        <div className="space-y-8">
         <div className="min-h-screen flex flex-col justify-center items-center">
  <div className="w-full max-w-md px-4"> {/* Adjust max-width as needed */}
    <h2 className="text-xl font-semibold mb-4 text-center">Group Balances</h2>
    <select 
      className="w-full p-2 border rounded mb-4"
      onChange={(e) => setSelectedGroup(e.target.value)}
      value={selectedGroup || ''}
    >
      <option value="">Select a group</option>
      {groups.map(group => (
        <option key={group.id} value={group.id}>{group.name}</option>
      ))}
    </select>
    {selectedGroup && <GroupBalance groupId={selectedGroup} />}
  </div>
</div>
          
          {/* <div>
            <h2 className="text-xl font-semibold mb-4">User Balances</h2>
            <select 
              className="w-full p-2 border rounded mb-4"
              onChange={(e) => setSelectedUser(e.target.value)}
              value={selectedUser || ''}
            >
              <option value="">Select a user</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
            {selectedUser && <UserBalances userId={selectedUser} />}
          </div> */}
        </div>

      </div>
    </div>
  );
}

export default App;