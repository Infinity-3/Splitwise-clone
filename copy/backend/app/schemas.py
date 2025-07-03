from typing import Dict, List, Optional,Union
from pydantic import BaseModel, validator, Field
from datetime import datetime
from enum import Enum

class SplitType(str, Enum):
    EQUAL = "equal"
    PERCENTAGE = "percentage"

class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class GroupBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    budget: float = Field(..., gt=0)

class GroupCreate(GroupBase):
    members: List[str] = Field(..., min_items=2)
    split_type: SplitType
    percentages: Optional[Dict[str, float]] = None

    @validator('percentages')
    def validate_percentages(cls, v, values):
        if values.get('split_type') == SplitType.PERCENTAGE:
            if not v:
                raise ValueError("Percentages required for percentage split")
            if abs(sum(v.values()) - 100) > 0.01:
                raise ValueError("Percentages must sum to 100")
        return v

class Group(GroupBase):
    id: int
    members: List[User]
    created_at: datetime
    updated_at: datetime
    current_spending: float
    remaining_budget: float

    class Config:
        orm_mode = True

class ExpenseSplit(BaseModel):
    user_id: int
    amount: Optional[float] = None
    percentage: Optional[float] = None

class ExpenseCreate(BaseModel):
    description: str
    amount: float = Field(..., gt=0)
    paid_by: int
    split_type: SplitType
    splits: List[ExpenseSplit]

    @validator('splits')
    def validate_splits(cls, v, values):
        if values.get('split_type') == SplitType.PERCENTAGE:
            total = sum(split.percentage or 0 for split in v)
            if abs(total - 100) > 0.01:
                raise ValueError("Total percentage must equal 100")
        return v

class Expense(ExpenseCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class Balance(BaseModel):
    user_id: int
    owes_to: int
    amount: float

class GroupBalance(BaseModel):
    total_spent: float
    remaining_budget: float
    budget_exceeded: bool
    balances: List[Balance]
    highest_spenders: List[Dict[str, Union[str, float]]]