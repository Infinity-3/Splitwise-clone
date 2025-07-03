from sqlalchemy.orm import Session
from . import models, schemas
from typing import Dict, List
import math

def create_group_with_members(db: Session, group: schemas.GroupCreate) -> models.Group:
    # Create users
    members = []
    for name in group.members:
        user = db.query(models.User).filter(models.User.name == name).first()
        if not user:
            user = models.User(name=name)
            db.add(user)
        members.append(user)
    
    db.commit()
    
    # Create group
    db_group = models.Group(name=group.name, budget=group.budget)
    db.add(db_group)
    db.commit()
    
    # Add members
    for user in members:
        db_group.members.append(user)
    
    db.commit()
    db.refresh(db_group)
    return db_group

def add_expense(db: Session, group_id: int, expense: schemas.ExpenseCreate) -> models.Expense:
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise ValueError("Group not found")
    
    # Validate payer is member
    payer = db.query(models.User).filter(models.User.id == expense.paid_by).first()
    if not payer or payer not in group.members:
        raise ValueError("Payer must be a group member")
    
    # Create expense
    db_expense = models.Expense(
        description=expense.description,
        amount=expense.amount,
        paid_by_id=expense.paid_by,
        group_id=group_id
    )
    db.add(db_expense)
    db.commit()
    
    # Create splits
    if expense.split_type == schemas.SplitType.EQUAL:
        split_amount = round(expense.amount / len(group.members), 2)
        for member in group.members:
            if member.id != expense.paid_by:
                db_split = models.ExpenseSplit(
                    expense_id=db_expense.id,
                    user_id=member.id,
                    amount=split_amount
                )
                db.add(db_split)
    
    elif expense.split_type == schemas.SplitType.PERCENTAGE:
        for split in expense.splits:
            if split.user_id not in [m.id for m in group.members]:
                raise ValueError("Split user must be group member")
            
            amount = round((expense.amount * split.percentage) / 100, 2)
            if split.user_id != expense.paid_by:
                db_split = models.ExpenseSplit(
                    expense_id=db_expense.id,
                    user_id=split.user_id,
                    amount=amount,
                    percentage=split.percentage
                )
                db.add(db_split)
    
    db.commit()
    db.refresh(db_expense)
    return db_expense

def get_group_balance(db: Session, group_id: int) -> schemas.GroupBalance:
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise ValueError("Group not found")
    
    # Calculate total spent
    total_spent = sum(exp.amount for exp in group.expenses)
    remaining_budget = group.budget - total_spent
    budget_exceeded = total_spent > group.budget
    
    # Calculate balances
    balances = {}
    for member in group.members:
        balances[member.id] = {m.id: 0.0 for m in group.members if m.id != member.id}
    
    for expense in group.expenses:
        payer_id = expense.paid_by_id
        for split in expense.splits:
            if split.user_id != payer_id:
                balances[split.user_id][payer_id] += split.amount
    
    # Convert to list format and find highest spenders
    balance_list = []
    spending_totals = {member.id: 0.0 for member in group.members}
    
    for debtor_id, creditors in balances.items():
        for creditor_id, amount in creditors.items():
            if amount > 0.01:
                balance_list.append(schemas.Balance(
                    user_id=debtor_id,
                    owes_to=creditor_id,
                    amount=round(amount, 2)
                ))
                spending_totals[creditor_id] += amount
    
    # Get top 3 highest spenders
    highest_spenders = sorted(
        [{"name": db.query(models.User).get(user_id).name, "amount": amount} 
         for user_id, amount in spending_totals.items() if amount > 0],
        key=lambda x: x["amount"],
        reverse=True
    )[:3]
    
    return schemas.GroupBalance(
        total_spent=round(total_spent, 2),
        remaining_budget=round(remaining_budget, 2),
        budget_exceeded=budget_exceeded,
        balances=balance_list,
        highest_spenders=highest_spenders
    )