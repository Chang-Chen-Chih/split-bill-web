import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase'; 
import { collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc } from 'firebase/firestore';

function App() {
  // --- 狀態管理 ---
  const [transactions, setTransactions] = useState([]); 
  const [loading, setLoading] = useState(true);

  // 輸入欄位狀態
  const [item, setItem] = useState('');       
  // const [unit, setUnit] = useState(''); // 移除單位
  const [category, setCategory] = useState(''); // 【新增】分類
  const [customCategory, setCustomCategory] = useState(''); // 【新增】自訂分類輸入框

  const [amount, setAmount] = useState('');   
  
  const [payer, setPayer] = useState('');         
  const [customPayer, setCustomPayer] = useState(''); 
  const [note, setNote] = useState('');       

  // --- 1. 付款人名單邏輯 (維持原樣) ---
  const allUsers = useMemo(() => {
    const historicalUsers = transactions.map(t => t.payer);
    return Array.from(new Set(historicalUsers));
  }, [transactions]); 

  // --- 2. 【新增】分類名單邏輯 ---
  // 定義固定的排序權重 (數字越小排越前面)
  const categoryOrder = ['喪葬費', '嘉義支出', '雜項'];

  const allCategories = useMemo(() => {
    // 從歷史紀錄抓出所有用過的分類
    const historicalCategories = transactions.map(t => t.category).filter(c => c);
    // 合併預設 + 歷史，並去除重複
    return Array.from(new Set([...categoryOrder, ...historicalCategories]));
  }, [transactions]);

  // --- 3. 【關鍵】列表排序邏輯 ---
  // 我們算出一個「排序後的列表」，而不直接用原始的 transactions
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      // 取得兩個項目的分類名稱
      const catA = a.category || '';
      const catB = b.category || '';

      // 取得它們在預設清單中的位置 (如果找不到會回傳 -1)
      let indexA = categoryOrder.indexOf(catA);
      let indexB = categoryOrder.indexOf(catB);

      // 如果是自訂分類 (index 為 -1)，我們給它一個很大的數字 (999)，讓它排在最後面
      if (indexA === -1) indexA = 999;
      if (indexB === -1) indexB = 999;

      // 比較權重
      if (indexA !== indexB) {
        return indexA - indexB; // 權重小的排前面
      }

      // 如果分類相同 (例如都是喪葬費)，則依照時間倒序 (新的在上面)
      return b.timestamp - a.timestamp; 
    });
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
    // 【新增】決定最終分類名稱
    const finalCategory = (category === 'NEW_CATEGORY') ? customCategory.trim() : category;

    if (!item || !amount) {
      alert("請至少輸入「項目」和「金額」！");
      return;
    }
    if (!finalPayer) {
      alert("請選擇付款人！");
      return;
    }
    if (!finalCategory) { // 【新增】檢查分類
      alert("請選擇細項分類！");
      return;
    }

    try {
      await addDoc(collection(db, "expenses"), {
        item,
        // unit, // 移除單位欄位
        category: finalCategory, // 【新增】存入分類
        amount: parseFloat(amount),
        payer: finalPayer,
        note,
        timestamp: new Date(),
        isPaid: false 
      });

      // 清空輸入框
      setItem('');
      // setUnit('');
      setCategory(''); // 重置分類
      setCustomCategory('');
      setAmount('');
      setNote('');
      setCustomPayer(''); 
      setPayer(''); 
      
      alert("新增成功！");
    } catch (e) {
      console.error("Error adding document: ", e);
      alert("新增失敗");
    }
  };

  // --- 切換付款狀態 ---
  const toggleStatus = async (id, currentStatus) => {
    if (currentStatus) return;
    try {
      const docRef = doc(db, "expenses", id);
      await updateDoc(docRef, { isPaid: true });
    } catch (e) {
      console.error("更新狀態失敗:", e);
      alert("更新失敗");
    }
  };

  // --- 計算總結 ---
  const summary = {};
  transactions.forEach(tx => {
    summary[tx.payer] = (summary[tx.payer] || 0) + tx.amount;
  });

  // --- UI Render ---
  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>活動支出紀錄表</h2>
      
      <div style={{ border: '1px solid #ddd', borderRadius: '10px', padding: '20px', backgroundColor: '#f9f9f9', marginBottom: '25px' }}>
        
        {/* 第一行：項目 + 分類 (原本是單位) */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <div style={{ flex: 1.5 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>項目 *</label>
            <input value={item} onChange={e => setItem(e.target.value)} placeholder="例如: 飲料" style={inputStyle} />
          </div>
          
          {/* 【修改】這裡改成細項分類選擇器 */}
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>細項分類 *</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
              <option value="" disabled>請選擇...</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="NEW_CATEGORY" style={{ fontWeight: 'bold', color: 'blue' }}>+ 自訂細項...</option>
            </select>
            {category === 'NEW_CATEGORY' && (
              <input value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="輸入新分類" style={{ ...inputStyle, marginTop: '5px', borderColor: '#2196F3', backgroundColor: '#e3f2fd' }} autoFocus />
            )}
          </div>
        </div>

        {/* 第二行：金額 + 付款人 (維持原樣) */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>金額 ($) *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>付款人 *</label>
            <select value={payer} onChange={e => setPayer(e.target.value)} style={inputStyle}>
              <option value="" disabled>請選擇...</option>
              {allUsers.map(u => <option key={u} value={u}>{u}</option>)}
              <option value="NEW_PAYER" style={{ fontWeight: 'bold', color: 'blue' }}>+ 自訂付款人...</option>
            </select>
            {payer === 'NEW_PAYER' && (
              <input value={customPayer} onChange={e => setCustomPayer(e.target.value)} placeholder="輸入新姓名" style={{ ...inputStyle, marginTop: '5px', borderColor: '#2196F3', backgroundColor: '#e3f2fd' }} autoFocus />
            )}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>備註</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="補充說明..." style={inputStyle} />
        </div>

        <button onClick={handleAdd} style={buttonStyle}>儲存到雲端</button>
      </div>

      {/* --- 列表區 --- */}
      <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        📝 支出明細 <span style={{fontSize:'0.6em', color:'#888', fontWeight:'normal'}}>(已依照細項排序)</span>
      </h3>
      
      <div style={{ marginBottom: '30px' }}>
        {sortedTransactions.length === 0 && !loading && <p style={{color:'#888', textAlign:'center'}}>目前沒有資料，請新增第一筆！</p>}
        
        {/* 這裡改用 sortedTransactions 來顯示 */}
        {sortedTransactions.map(tx => (
            <div key={tx.id} style={listItemStyle}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#333' }}>
                  {tx.item} 
                  {/* 把原本顯示 unit 的地方改成 category，並用不同顏色標示 */}
                  <span style={{ 
                    fontSize: '0.7em', 
                    color: 'white', 
                    backgroundColor: '#666', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    marginLeft: '8px',
                    verticalAlign: 'middle',
                    fontWeight: 'normal'
                  }}>
                    {tx.category}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontWeight: 'bold', color: '#d9534f', fontSize: '1.2em' }}>
                    ${tx.amount}
                  </div>
                  
                  <button 
                    onClick={() => toggleStatus(tx.id, tx.isPaid)}
                    disabled={tx.isPaid}
                    style={{
                      ...statusButtonStyle,
                      backgroundColor: tx.isPaid ? '#4CAF50' : '#e0e0e0',
                      color: tx.isPaid ? 'white' : '#555',
                      cursor: tx.isPaid ? 'default' : 'pointer',
                    }}
                  >
                    {tx.isPaid ? '已付款 ✓' : '未付款'}
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '0.95em', color: '#666', borderTop: '1px dashed #eee', paddingTop: '8px' }}>
                付款人: <span style={{ color: '#007bff', fontWeight: 'bold' }}>{tx.payer}</span>
                {tx.note && <span style={{ marginLeft: '10px', color: '#999' }}>| 備註: {tx.note}</span>}
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
const listItemStyle = { backgroundColor: 'white', border: '1px solid #eee', borderRadius: '8px', padding: '15px', marginBottom: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' };

const statusButtonStyle = {
  border: 'none',
  borderRadius: '20px',
  padding: '5px 12px',
  fontSize: '0.8em',
  transition: 'background 0.3s',
  fontWeight: 'bold',
  minWidth: '70px',
};

export default App;