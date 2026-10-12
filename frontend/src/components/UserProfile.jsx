import React from 'react';
import styles from './UserProfile.module.css';

const UserProfile = ({ user }) => {
  return (
    <div className={styles.profileCard}>
      <img src={user.avatar} alt="Profile" className={styles.avatar} />
      <div className={styles.info}>
        <h2 className={styles.name}>{user.username}</h2>
        <p className={styles.balance}>💰 {user.balance} Coins</p>
      </div>
    </div>
  );
};

export default UserProfile;
