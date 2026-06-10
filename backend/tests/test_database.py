import pytest
from modules.database import init_db, db_get_user, db_create_user, db_delete_user

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()

def test_user_creation_and_retrieval():
    test_username = "test_hrbp_user"
    test_password = "secure_password"
    
    # Clean up if exists
    db_delete_user(test_username)
    
    # Create
    success = db_create_user(test_username, test_password, "Test HRBP", "hrbp")
    assert success is True
    
    # Retrieve
    user = db_get_user(test_username)
    assert user is not None
    assert user["username"] == test_username
    assert user["role"] == "hrbp"
    assert user["is_active"] is True
    
    # Cleanup
    db_delete_user(test_username)
