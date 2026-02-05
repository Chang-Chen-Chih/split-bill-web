import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

function App() {
  // --- 狀態管理 ---
  const [transactions, setTransactions] = useState([]); 
  const [loading, setLoading] = useState(true);

  // 輸入欄位狀態
  const [item, setItem] = useState('');       
  const [unit, setUnit] = useState('');       
  const [amount, setAmount] = useState('');   
  
  // 付款人相關狀態
  // 改動 1: 預設值改成空字串，因為現在沒有預設名單了
  const [payer, setPayer] = useState('');         
  const [customPayer, setCustomPayer] = useState(''); 
  
  const [note, setNote] = useState('');       

  // 改動 2: 移除了 const defaultUsers = [...]

  // 改動 3: 動態計算名單 (只從歷史紀錄抓，不合併預設名單了)
  const allUsers = useMemo(() => {
    const historicalUsers = transactions.map(t => t.payer);
    // 只留不重複的名字
    return Array.from(new Set(historicalUsers));
  }, [transactions]); 

  // --- 監聽資料庫 ---
  useEffect(() => {
    const q = query(collection(db, "expenses"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTransactions(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 新增資料 ---
  const handleAdd = async () => {
    const finalPayer = (payer === 'NEW_PAYER') ? customPayer.trim() : payer;

    if (!item || !amount) {
      alert("請至少輸入「項目」和「金額」！");
      return;
    }
    if (!finalPayer) {
      alert("請選擇或輸入付款人姓名！");
      return;
    }

    try {
      await addDoc(collection(db, "expenses"), {
        item,
        unit,
        amount: parseFloat(amount),
        payer: finalPayer,
        note,
        timestamp: new Date()
      });

      // 清空輸入框
      setItem('');
      setUnit('');
      setAmount('');
      setNote('');
      setCustomPayer(''); 
      // 新增完後，把選擇器重置回空，強迫使用者下一筆要重新選人 (避免誤選)
      setPayer(''); 
      
      alert("新增成功！");
    } catch (e) {
      console.error("Error adding document: ", e);
      alert("新增失敗");
    }
  };

  // --- 計算總結 ---
  const summary = {};
  transactions.forEach(tx => {
    summary[tx.payer] = (summary[tx.payer] || 0) + tx.amount;
  });
  // 改動 4: 移除了把 defaultUsers 填補為 0 的邏輯
  // 現在只有真正有花錢的人才會出現在統計表

  // --- UI Render ---
  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>活動支出紀錄表</h2>
      
      <div style={{ border: '1px solid #ddd', borderRadius: '10px', padding: '20px', backgroundColor: '#f9f9f9', marginBottom: '25px' }}>
        
        {/* 第一行 */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>項目 *</label>
            <input value={item} onChange={e => setItem(e.target.value)} placeholder="例如: 飲料" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>單位</label>
            <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="箱/個" style={inputStyle} />
          </div>
        </div>

        {/* 第二行 */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>金額 ($) *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={inputStyle} />
          </div>
          
          {/* 付款人選擇區 */}
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>付款人 *</label>
            <select 
              value={payer} 
              onChange={e => setPayer(e.target.value)}
              style={inputStyle}
            >
              {/* 改動 5: 加入一個預設的提示選項 */}
              <option value="" disabled>請選擇...</option>
              
              {allUsers.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
              <option value="NEW_PAYER" style={{ fontWeight: 'bold', color: 'blue' }}>+ 自訂付款人...</option>
            </select>
            
            {payer === 'NEW_PAYER' && (
              <input 
                value={customPayer}
                onChange={e => setCustomPayer(e.target.value)}
                placeholder="輸入新姓名"
                style={{ ...inputStyle, marginTop: '5px', borderColor: '#2196F3', backgroundColor: '#e3f2fd' }}
                autoFocus
              />
            )}
          </div>
        </div>

        {/* 第三行 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>備註</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="補充說明..." style={inputStyle} />
        </div>

        <button onClick={handleAdd} style={buttonStyle}>儲存到雲端</button>
      </div>

      {/* --- 列表區 --- */}
      <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        📝 支出明細 <span style={{fontSize:'0.6em', color:'#888', fontWeight:'normal'}}>(如需刪除請至後台操作)</span>
      </h3>
      
      <div style={{ marginBottom: '30px' }}>
        {transactions.length === 0 && !loading && <p style={{color:'#888', textAlign:'center'}}>目前沒有資料，請新增第一筆！</p>}
        {transactions.map(tx => (
            <div key={tx.id} style={listItemStyle}>
              {/* 左邊：項目資訊 */}
              <div>
                <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: '#333' }}>
                  {tx.item} 
                  {tx.unit && <span style={{ fontSize: '0.8em', color: '#666', marginLeft: '5px' }}>({tx.unit})</span>}
                </div>
                <div style={{ fontSize: '0.9em', color: '#666', marginTop: '5px' }}>
                  付款人: <span style={{ color: '#007bff' }}>{tx.payer}</span>
                  {tx.note && <span style={{ marginLeft: '10px', color: '#999' }}>| 備註: {tx.note}</span>}
                </div>
              </div>

              {/* 右邊：金額 */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 'bold', color: '#d9534f', fontSize: '1.2em' }}>
                  ${tx.amount}
                </div>
              </div>
            </div>
        ))}
      </div>

      <div style={{ backgroundColor: '#333', color: 'white', padding: '20px', borderRadius: '10px' }}>
        <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '10px' }}>📊 總支出統計</h3>
        {Object.keys(summary).length === 0 ? (
          <p style={{color: '#aaa', fontStyle:'italic'}}>尚無統計資料</p>
        ) : (
          Object.entries(summary).map(([user, total]) => (
            <div key={user} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>{user}</span>
              <span style={{ color: '#4CAF50' }}>${total}</span>
            </div>
          ))
        )}
        
        {Object.keys(summary).length > 0 && (
          <>
            <hr style={{ borderColor: '#555' }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2em', fontWeight: 'bold' }}>
              <span>總計</span>
              <span>${Object.values(summary).reduce((a,b)=>a+b, 0)}</span>
            </div>
          </>
        )}
      </div>

    </div>
  );
}

// --- 樣式物件 ---
const inputStyle = { width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '5px', border: '1px solid #ccc' };
const buttonStyle = { width: '100%', padding: '12px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', cursor: 'pointer' };
const listItemStyle = { backgroundColor: 'white', border: '1px solid #eee', borderRadius: '8px', padding: '15px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };

export default App;