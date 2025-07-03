from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from . import crud, models, schemas
from .database import SessionLocal, engine
import math

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],  # Ensure all methods are allowed
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
# Debug endpoints
@app.get("/debug/group-members")
def debug_group_members(db: Session = Depends(get_db)):
    groups = db.query(models.Group).all()
    return [
        {"group": group.name, "members": [user.name for user in group.members]}
        for group in groups
    ]


# User endpoints
@app.post("/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    return crud.create_user(db, user=user)

@app.post("/users/batch", response_model=List[schemas.User])
def create_users(users: List[schemas.UserCreate], db: Session = Depends(get_db)):
    created = []
    for user in users:
        if crud.get_user_by_email(db, email=user.email):
            continue  # Skip existing users
        created.append(crud.create_user(db, user=user))
    return created


@app.get("/users/", response_model=List[schemas.User])
def read_users(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db)
):
    return crud.get_users(db, skip=skip, limit=limit)


@app.get("/users/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@app.get("/users/{user_id}/balances", response_model=List[schemas.Balance])
def get_user_balances(user_id: int, db: Session = Depends(get_db)):
    return crud.get_user_balances(db, user_id=user_id)


# GROUP ENDPOINTS
@app.post("/groups/", response_model=schemas.Group)
def create_group(group: schemas.GroupCreate, db: Session = Depends(get_db)):
    """Create a new group"""
    return crud.create_group(db, group=group)

@app.get("/groups/", response_model=List[schemas.Group])
def read_groups(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all groups"""
    return crud.get_groups(db, skip=skip, limit=limit)

@app.get("/groups/{group_id}", response_model=schemas.Group)
def read_group(group_id: int, db: Session = Depends(get_db)):
    """Get a specific group"""
    db_group = crud.get_group(db, group_id=group_id)
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")
    return db_group

@app.delete("/groups/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db)):
    """Delete a group"""
    if not crud.delete_group(db, group_id=group_id):
        raise HTTPException(status_code=404, detail="Group not found")
    return {"message": "Group deleted successfully"}

@app.get("/groups/{group_id}/expenses", response_model=List[schemas.Expense])
def read_group_expenses(group_id: int, db: Session = Depends(get_db)):
    return crud.get_group_expenses(db, group_id=group_id)


@app.post("/groups/{group_id}/expenses", response_model=schemas.Expense)
def create_expense(
    group_id: int,
    expense: schemas.ExpenseCreate,
    db: Session = Depends(get_db)
):
    # Verify group exists
    group = crud.get_group(db, group_id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Verify payer is a group member
    payer = crud.get_user(db, user_id=expense.paid_by)
    if not payer:
        raise HTTPException(status_code=404, detail="Payer not found")
    if payer not in group.members:
        raise HTTPException(status_code=400, detail="Payer is not a group member")
    
    # Validate splits based on split type
    if expense.split_type == "percentage":
        total_percentage = sum(split.percentage for split in expense.splits)
        if total_percentage != 100:
            raise HTTPException(
                status_code=400,
                detail="Total percentage must equal 100"
            )
        
    elif expense.split_type == "exact":
        total_amount = sum(split.amount for split in expense.splits)
        if not math.isclose(total_amount, expense.amount, rel_tol=1e-9):
            raise HTTPException(
                status_code=400,
                detail="Sum of exact amounts must equal expense amount"
            )
    
    # Create the expense
    return crud.add_expense(db, group_id=group_id, expense=expense)

@app.get("/groups/{group_id}/balances", response_model=List[schemas.Balance])
def get_balances(group_id: int, db: Session = Depends(get_db)):
    return crud.get_group_balances(db, group_id=group_id)