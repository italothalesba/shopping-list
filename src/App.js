import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { db } from './firebaseConfig';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  writeBatch
} from 'firebase/firestore';

const PRIORITY_ORDER = {
  'Alta': 1,
  'Média': 2,
  'Baixa': 3,
};

const shoppingItemsCollectionRef = collection(db, "shoppingItems");

// =============================
// COMPONENTE: SHOPPING ITEM CARD
// =============================
function ShoppingItemCard({
    item,
    onDeleteItem,
    onUpdateItem, // Now receives subcategory parameter as well
    onAddOrUpdateMarketPrice,
    onDeleteMarketPrice,
    isMarketMode,
    currentMarketForShopping,
    onToggleInCart,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(item.name);
    const [editedPriority, setEditedPriority] = useState(item.priority);
    const [editedQuantity, setEditedQuantity] = useState(item.quantity);
    const [editedUnit, setEditedUnit] = useState(item.unit);
    const [editedSubcategory, setEditedSubcategory] = useState(item.subcategory || '');
    const [editedQuantityError, setEditedQuantityError] = useState('');

    const [marketNameInput, setMarketNameInput] = useState('');
    const [priceInput, setPriceInput] = useState('');
    const [priceInputError, setPriceInputError] = useState('');
    const [marketNameInputError, setMarketNameInputError] = useState('');

    const [currentMarketPriceEdit, setCurrentMarketPriceEdit] = useState(() => {
        if (isMarketMode && currentMarketForShopping) {
            const currentMarketData = item.markets.find(m => m.marketName.toLowerCase() === currentMarketForShopping.toLowerCase());
            return currentMarketData ? currentMarketData.price.toFixed(2) : '';
        }
        return '';
    });

    // NEW: State for market mode purchased quantity
    const [purchasedQuantity, setPurchasedQuantity] = useState(item.quantity);
    const [purchasedQuantityError, setPurchasedQuantityError] = useState('');

    // Effect to update internal edit states and market price edit state when item props change
    useEffect(() => {
        if (isMarketMode && currentMarketForShopping) {
            const currentMarketData = item.markets.find(m => m.marketName.toLowerCase() === currentMarketForShopping.toLowerCase());
            setCurrentMarketPriceEdit(currentMarketData ? currentMarketData.price.toFixed(2) : '');
        } else {
            setCurrentMarketPriceEdit('');
        }
        setEditedName(item.name);
        setEditedPriority(item.priority);
        setEditedQuantity(item.quantity);
        setEditedUnit(item.unit);
        setEditedSubcategory(item.subcategory || '');
        setPurchasedQuantity(item.quantity); // NEW: Update purchasedQuantity on item change
    }, [isMarketMode, currentMarketForShopping, item.markets, item.name, item.priority, item.quantity, item.unit, item.subcategory]);


    const cheapestMarket = item.markets.length > 0
        ? item.markets.reduce((prev, current) => prev.price < current.price ? prev : current)
        : null;

    // Handler for updating quantity in Market Mode
    const handlePurchasedQuantityChange = async (e) => {
        const newQty = e.target.value;
        setPurchasedQuantity(newQty); // Update local state for immediate feedback

        const parsedQty = parseFloat(newQty);
        if (isNaN(parsedQty) || parsedQty <= 0) {
            setPurchasedQuantityError('Qtd inválida (deve ser positiva).');
        } else {
            setPurchasedQuantityError('');
            // NEW: Update the item's quantity in Firebase, so App's total calculation works.
            // Passes current item's original name, priority, unit and subcategory
            await onUpdateItem(item.id, item.name, item.priority, parsedQty, item.unit, item.subcategory);
        }
    };


    const handleEditSave = async () => {
        let valid = true;
        if (!editedName.trim()) {
            alert('O nome do item não pode ser vazio!');
            valid = false;
        }

        const parsedQuantity = parseFloat(editedQuantity);
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            setEditedQuantityError('A quantidade deve ser um número positivo.');
            valid = false;
        } else {
            setEditedQuantityError('');
        }

        if (valid) {
            await onUpdateItem(
                item.id,
                editedName.trim(),
                editedPriority,
                parsedQuantity,
                editedUnit,
                editedSubcategory.trim() || null
            );
            setIsEditing(false);
        }
    };

    const handleAddPriceSubmit = async (e) => {
        e.preventDefault();

        let valid = true;
        if (!marketNameInput.trim()) {
            setMarketNameInputError('Mercado é obrigatório');
            valid = false;
        } else {
            setMarketNameInputError('');
        }

        const parsedPrice = parseFloat(priceInput);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            setPriceInputError('Preço inválido ou deve ser positivo');
            valid = false;
        } else {
            setPriceInputError('');
        }

        if (valid) {
            await onAddOrUpdateMarketPrice(item.id, marketNameInput.trim(), parsedPrice);
            setMarketNameInput('');
            setPriceInput('');
        }
    };

    const handleUpdateCurrentMarketPrice = async () => {
        if (!currentMarketForShopping) return;

        const parsedPrice = parseFloat(currentMarketPriceEdit);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            setPriceInputError('Preço inválido (deve ser um número positivo ou zero para item não encontrado).');
        } else {
            await onAddOrUpdateMarketPrice(item.id, currentMarketForShopping, parsedPrice);
            setPriceInputError('');
        }
    };

    const priorityColorClass = `priority-${item.priority.toLowerCase()}`;

    if (!isMarketMode) {
        return (
            <div className="item-card">
                <div className="item-header">
                    {isEditing ? (
                        <div className="item-edit-mode-container">
                            <input
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="edit-input item-name-edit"
                                aria-label="Editar nome do item"
                            />
                            <div className="quantity-unit-edit-group">
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={editedQuantity}
                                    onChange={(e) => setEditedQuantity(e.target.value)}
                                    className={`edit-input quantity-edit-input ${editedQuantityError ? 'input-error' : ''}`}
                                    aria-label="Editar quantidade total"
                                />
                                <select
                                    value={editedUnit}
                                    onChange={(e) => setEditedUnit(e.target.value)}
                                    className="edit-select unit-edit-select"
                                    aria-label="Editar unidade de medida total"
                                >
                                    <option value="unidade">Unidade</option>
                                    <option value="grama">Grama</option>
                                    <option value="quilo">Quilo</option>
                                </select>
                            </div>
                            {editedQuantityError && <div className="input-error-message edit-error-message">{editedQuantityError}</div>}
                            <input
                                type="text"
                                placeholder="Subcategoria (opcional)"
                                value={editedSubcategory}
                                onChange={(e) => setEditedSubcategory(e.target.value)}
                                className="edit-input subcategory-edit-input"
                                aria-label="Editar subcategoria do item"
                                list="available-subcategories"
                            />

                            <select
                                value={editedPriority}
                                onChange={(e) => setEditedPriority(e.target.value)}
                                className="edit-select priority-edit-select"
                                aria-label="Editar prioridade do item"
                            >
                                <option value="Alta">Alta</option>
                                <option value="Média">Média</option>
                                <option value="Baixa">Baixa</option>
                            </select>
                            <div className="edit-actions">
                                <button onClick={handleEditSave} className="save-button" aria-label="Salvar edição">
                                    &#10003; Salvar
                                </button>
                                <button onClick={() => { setIsEditing(false); setEditedQuantityError(''); }} className="cancel-button" aria-label="Cancelar edição">
                                    X Cancelar
                                </button>
                            </div>
                        </div>
                    ) : ( // View mode UI
                        <>
                            <h3 className="item-name">
                                {item.name}
                                <span className="item-quantity-display">
                                    ({item.quantity} {item.unit})
                                </span>
                                {item.subcategory && <span className="item-subcategory">({item.subcategory})</span>}
                                <span className={`priority-tag ${priorityColorClass}`}>
                                    {item.priority}
                                </span>
                            </h3>
                            <div className="item-actions">
                                <button onClick={() => setIsEditing(true)} className="action-button edit-button" aria-label={`Editar ${item.name}`}>
                                    &#9998;
                                </button>
                                <button onClick={() => onDeleteItem(item.id)} className="action-button delete-button" aria-label={`Deletar ${item.name}`}>
                                    &#128465;
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className="market-prices">
                    <h4>Preços Unitários Registrados (por {item.unit}):</h4>
                    {item.markets.length === 0 ? (
                        <p className="no-prices-text">Nenhum preço adicionado ainda para este item.</p>
                    ) : (
                        <ul>
                            {item.markets.map((market) => (
                                <li key={market.marketName} className="market-item">
                                    <span className="market-details">
                                        {market.marketName}: <span className="price-value">R$ {market.price.toFixed(2)}</span>
                                    </span>
                                    <button
                                        onClick={() => onDeleteMarketPrice(item.id, market.marketName)}
                                        className="delete-market-price-button" aria-label={`Remover preço de ${market.marketName}`}
                                    >
                                        X
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {cheapestMarket && (
                    <div className="cheapest-market-info">
                        <strong>Melhor Preço Geral:</strong>{' '}
                        <span className="cheapest-market-name">{cheapestMarket.marketName}</span> (
                        <span className="cheapest-price-value">R$ {cheapestMarket.price.toFixed(2)}</span> / {item.unit})
                        <span className="best-price-indicator">&#128073;</span>
                    </div>
                )}

                <form onSubmit={handleAddPriceSubmit} className="add-market-price-form">
                    <input
                        type="text"
                        placeholder="Nome do Mercado"
                        value={marketNameInput}
                        onChange={(e) => setMarketNameInput(e.target.value)}
                        className={`market-input ${marketNameInputError ? 'input-error' : ''}`}
                        aria-label="Nome do Mercado"
                    />
                    <input
                        type="number"
                        step="0.01"
                        placeholder={`Preço (R$) / ${item.unit}`}
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        className={`price-input ${priceInputError ? 'input-error' : ''}`}
                        aria-label="Preço do Item"
                    />
                    <button type="submit" className="add-price-button" aria-label="Adicionar ou Atualizar Preço">
                        + Preço
                    </button>
                    {(marketNameInputError || priceInputError) && (
                        <div className="input-error-message">
                            {marketNameInputError} {priceInputError && marketNameInputError ? ' | ' : ''} {priceInputError}
                        </div>
                    )}
                </form>
            </div>
        );
    }


    // --- RENDERIZANDO PARA MODO DE MERCADO ---
    const otherMarketsPrices = item.markets.filter(
        (m) => m.marketName.toLowerCase() !== currentMarketForShopping?.toLowerCase()
    );

    return (
        <div className="item-card market-mode-card">
            <div className="item-header market-mode-header">
                <input
                    type="checkbox"
                    checked={item.isInCart}
                    onChange={() => onToggleInCart(item.id, !item.isInCart)}
                    className="item-cart-checkbox"
                    aria-label={`Marcar ${item.quantity} ${item.unit} de ${item.name} no carrinho`}
                />
                <h3 className="item-name-market-mode">
                    {item.name}
                    <span className="item-quantity-display-market">
                        {/* NEW: Display purchased quantity if different from item.quantity */}
                        {purchasedQuantity} {item.unit}
                    </span>
                    {item.subcategory && <span className="item-subcategory-market">({item.subcategory})</span>}
                </h3>
                <div className={`priority-tag ${priorityColorClass} market-mode-priority`}>
                    {item.priority}
                </div>
            </div>

            {currentMarketForShopping ? (
                <>
                    <div className="market-mode-quantity-control"> {/* NEW: Container for quantity and price edit */}
                         <label className="market-mode-quantity-label">
                            Comprar:
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={purchasedQuantity}
                                onChange={handlePurchasedQuantityChange}
                                onBlur={handlePurchasedQuantityChange} // Ensure update on blur too
                                className={`market-mode-purchased-quantity-input ${purchasedQuantityError ? 'input-error' : ''}`}
                                aria-label={`Quantidade de ${item.name} a comprar`}
                            />
                            <span>{item.unit}</span>
                        </label>
                         {purchasedQuantityError && (
                            <div className="input-error-message purchased-qty-error">{purchasedQuantityError}</div>
                        )}

                        <div className="current-market-price-edit">
                            <label className="current-market-label">
                                Preço Unitário em "<span className="market-name-highlight">{currentMarketForShopping}</span>" (/{item.unit}):
                                <input
                                    type="number"
                                    step="0.01"
                                    value={currentMarketPriceEdit}
                                    onChange={(e) => {
                                        setCurrentMarketPriceEdit(e.target.value);
                                        setPriceInputError('');
                                    }}
                                    onBlur={handleUpdateCurrentMarketPrice}
                                    className={`market-mode-price-input ${priceInputError ? 'input-error' : ''}`}
                                    aria-label={`Preço para ${purchasedQuantity} ${item.unit} de ${item.name} no mercado ${currentMarketForShopping}`}
                                />
                            </label>
                            {priceInputError && (
                                 <div className="input-error-message price-error-market-mode">{priceInputError}</div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <p className="no-market-selected-text">Selecione um mercado acima para editar preços e somar o total.</p>
            )}

            {otherMarketsPrices.length > 0 && currentMarketForShopping ? (
                <div className="other-market-prices-comparison">
                    <h5>Comparar Preços Unitários (/{item.unit}):</h5>
                    <ul>
                        {otherMarketsPrices.map((market) => (
                            <li key={market.marketName}>
                                {market.marketName}: <span className="price-value">R$ {market.price.toFixed(2)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : ( currentMarketForShopping &&
                <p className="no-other-markets-text">Nenhum outro preço registrado para este item.</p>
            )}

             {cheapestMarket && (!currentMarketForShopping || item.markets.every(m => m.marketName.toLowerCase() !== currentMarketForShopping.toLowerCase())) && (
                    <div className="cheapest-market-info">
                        <strong>Melhor Preço Geral:</strong>{' '}
                        <span className="cheapest-market-name">{cheapestMarket.marketName}</span> (
                        <span className="cheapest-price-value">R$ {cheapestMarket.price.toFixed(2)}</span> / {item.unit})
                        <span className="best-price-indicator">&#128073;</span>
                    </div>
                )}
        </div>
    );
}


// =============================
// COMPONENTE PRINCIPAL: APP
// =============================
function App() {
    const [shoppingItems, setShoppingItems] = useState([]);
    const [newItemName, setNewItemName] = useState('');
    const [newItemPriority, setNewItemPriority] = useState('Média');
    const [newItemQuantity, setNewItemQuantity] = useState(1);
    const [newItemUnit, setNewItemUnit] = useState('unidade');
    const [newItemSubcategory, setNewItemSubcategory] = useState('');

    const [newItemNameError, setNewItemNameError] = useState('');
    const [newItemQuantityError, setNewItemQuantityError] = useState('');

    const [isMarketMode, setIsMarketMode] = useState(false);
    const [currentMarketForShopping, setCurrentMarketForShopping] = useState('');
    const [currentMarketInput, setCurrentMarketInput] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSubcategoryFilter, setSelectedSubcategoryFilter] = useState('');

    const availableSubcategories = useMemo(() => {
        const unique = new Set(shoppingItems
            .map(item => item.subcategory)
            .filter(sub => sub && typeof sub === 'string' && sub.trim() !== '')
            .map(sub => sub.trim())
        );
        return Array.from(unique).sort((a, b) => a.localeCompare(b));
    }, [shoppingItems]);

    const getShoppingItems = async () => {
        console.log("Attempting to fetch shopping items from Firestore...");
        try {
            const q = query(shoppingItemsCollectionRef, orderBy('priority', 'asc'), orderBy('name', 'asc'));
            const querySnapshot = await getDocs(q);

            console.log("Firestore query successful.");
            if (querySnapshot.empty) {
                console.log("No documents found in 'shoppingItems' collection.");
            } else {
                console.log(`Found ${querySnapshot.docs.length} documents.`);
            }

            const items = querySnapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    isInCart: data.hasOwnProperty('isInCart') ? data.isInCart : false,
                    quantity: data.quantity !== undefined ? data.quantity : 1,
                    unit: data.unit || 'unidade',
                    subcategory: data.subcategory || '',
                };
            });
            console.log("Fetched items: ", items);
            setShoppingItems(items);
        } catch (error) {
            console.error("ERROR fetching shopping items from Firestore: ", error);
            alert("Erro ao carregar itens de compra. Verifique sua conexão ou as configurações do Firebase/Regras de Segurança.");
        }
    };

    useEffect(() => {
        getShoppingItems();
    }, []);


    const handleAddItem = async (e) => {
        e.preventDefault();

        let valid = true;
        if (!newItemName.trim()) {
            setNewItemNameError('O nome do item é obrigatório.');
            valid = false;
        } else {
            setNewItemNameError('');
        }

        const parsedQuantity = parseFloat(newItemQuantity);
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            setNewItemQuantityError('A quantidade deve ser um número positivo.');
            valid = false;
        } else {
            setNewItemQuantityError('');
        }

        if (!valid) return;

        const newItem = {
            name: newItemName.trim(),
            priority: newItemPriority,
            quantity: parsedQuantity,
            unit: newItemUnit,
            subcategory: newItemSubcategory.trim() || null,
            markets: [],
            isInCart: false,
        };

        try {
            await addDoc(shoppingItemsCollectionRef, newItem);
            getShoppingItems();
            setNewItemName('');
            setNewItemPriority('Média');
            setNewItemQuantity(1);
            setNewItemUnit('unidade');
            setNewItemSubcategory('');
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Erro ao adicionar item: " + error.message);
        }
    };

    const handleDeleteItem = async (id) => {
        if (window.confirm('Tem certeza que deseja remover este item permanentemente?')) {
            try {
                const itemDoc = doc(db, "shoppingItems", id);
                await deleteDoc(itemDoc);
                getShoppingItems();
            } catch (error) {
                console.error("Error deleting document: ", error);
                alert("Erro ao deletar item: " + error.message);
            }
        }
    };

    // onUpdateItem now accepts subcategory parameter
    const handleUpdateItem = async (id, newName, newPriority, newQuantity, newUnit, newSubcategory) => {
        try {
            const itemDoc = doc(db, "shoppingItems", id);
            await updateDoc(itemDoc, {
                name: newName,
                priority: newPriority,
                quantity: newQuantity,
                unit: newUnit,
                subcategory: newSubcategory,
            });
            getShoppingItems();
        } catch (error) {
            console.error("Error updating document: ", error);
            alert("Erro ao atualizar item: " + error.message);
        }
    };

    const handleAddOrUpdateMarketPrice = async (id, marketName, price) => {
        try {
            const itemToUpdate = shoppingItems.find(item => item.id === id);
            if (!itemToUpdate) return;

            const updatedMarkets = [...itemToUpdate.markets];
            const existingMarketIndex = updatedMarkets.findIndex(m => m.marketName.toLowerCase() === marketName.toLowerCase());

            if (existingMarketIndex > -1) {
                updatedMarkets[existingMarketIndex] = { ...updatedMarkets[existingMarketIndex], marketName: marketName, price: price };
            } else {
                updatedMarkets.push({ marketName: marketName, price: price });
            }

            const itemDoc = doc(db, "shoppingItems", id);
            await updateDoc(itemDoc, { markets: updatedMarkets });
            getShoppingItems();
        } catch (error) {
            console.error("Error updating market price: ", error);
            alert("Erro ao atualizar preço do mercado: " + error.message);
        }
    };

    const handleDeleteMarketPrice = async (itemId, marketName) => {
        try {
            const itemToUpdate = shoppingItems.find(item => item.id === itemId);
            if (!itemToUpdate) return;

            const updatedMarkets = itemToUpdate.markets.filter((m) => m.marketName !== marketName);

            const itemDoc = doc(db, "shoppingItems", itemId);
            await updateDoc(itemDoc, { markets: updatedMarkets });
            getShoppingItems();
        } catch (error) {
            console.error("Error deleting market price: ", error);
            alert("Erro ao deletar preço do mercado: " + error.message);
        }
    };

    const handleToggleInCart = async (id, isInCart) => {
        try {
            const itemDoc = doc(db, "shoppingItems", id);
            await updateDoc(itemDoc, { isInCart: isInCart });
            getShoppingItems();
        } catch (error) {
            console.error("Error toggling in cart status: ", error);
            alert("Erro ao atualizar status do carrinho: " + error.message);
        }
    };

    const calculateMarketModeTotal = () => {
        let total = 0;
        shoppingItems.forEach(item => {
            if (item.isInCart && currentMarketForShopping) {
                const priceData = item.markets.find(m => m.marketName.toLowerCase() === currentMarketForShopping.toLowerCase());
                if (priceData && priceData.price >= 0 && item.quantity > 0) {
                    total += priceData.price * item.quantity;
                }
            }
        });
        return total.toFixed(2);
    };

    const handleSetCurrentMarket = (e) => {
        e.preventDefault();
        if (currentMarketInput.trim()) {
            setCurrentMarketForShopping(currentMarketInput.trim());
        } else {
            alert('Por favor, insira o nome do mercado para iniciar o modo de compras.');
        }
    };

    const handleClearCurrentMarket = async () => {
        setCurrentMarketForShopping('');
        setCurrentMarketInput('');

        const batch = writeBatch(db);
        shoppingItems.forEach(item => {
            if (item.isInCart) {
                const itemRef = doc(db, "shoppingItems", item.id);
                batch.update(itemRef, { isInCart: false });
            }
        });

        try {
            await batch.commit();
            getShoppingItems();
        } catch (error) {
            console.error("Error resetting isInCart status in batch: ", error);
            alert("Erro ao limpar carrinho: " + error.message);
        }
    };

    const filteredAndSortedItems = useMemo(() => {
        let itemsToFilter = [...shoppingItems];

        if (searchQuery.trim() !== '') {
            const lowerCaseQuery = searchQuery.toLowerCase();
            itemsToFilter = itemsToFilter.filter(item =>
                item.name.toLowerCase().includes(lowerCaseQuery) ||
                (item.subcategory && item.subcategory.toLowerCase().includes(lowerCaseQuery))
            );
        }

        if (selectedSubcategoryFilter !== '') {
            itemsToFilter = itemsToFilter.filter(item => item.subcategory === selectedSubcategoryFilter);
        }

        return itemsToFilter.sort((a, b) => {
            const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.name.localeCompare(b.name);
        });
    }, [shoppingItems, searchQuery, selectedSubcategoryFilter]);

    return (
        <div className="container">
            <h1 className="header">🛒 Lista de Compras Inteligente</h1>

            <div className="mode-toggle-container">
                <button
                    onClick={() => setIsMarketMode(false)}
                    className={`mode-button ${!isMarketMode ? 'active-mode' : ''}`}
                    aria-pressed={!isMarketMode}
                >
                    📝 Modo Planejamento
                </button>
                <button
                    onClick={() => setIsMarketMode(true)}
                    className={`mode-button ${isMarketMode ? 'active-mode' : ''}`}
                    aria-pressed={isMarketMode}
                >
                    🛒 Modo Mercado
                </button>
            </div>

            {/* Search Bar and NEW: Subcategory Filter Dropdown */}
            <div className="filter-controls-container">
                <input
                    type="text"
                    placeholder="Pesquisar por nome ou subcategoria..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                    aria-label="Barra de pesquisa de itens"
                />
                <select
                    value={selectedSubcategoryFilter}
                    onChange={(e) => setSelectedSubcategoryFilter(e.target.value)}
                    className="subcategory-filter-select"
                    aria-label="Filtrar por subcategoria"
                >
                    <option value="">Todas as Subcategorias</option>
                    {availableSubcategories.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                    ))}
                </select>
            </div>

            {!isMarketMode ? ( // MODO PLANEJAMENTO
                <>
                    <form onSubmit={handleAddItem} className="add-item-form">
                        <input
                            type="text"
                            placeholder="Nome do Item (ex: Arroz)"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            className={`item-name-input ${newItemNameError ? 'input-error' : ''}`}
                            aria-label="Nome do novo item"
                        />
                        <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Qtd. Total"
                            value={newItemQuantity}
                            onChange={(e) => setNewItemQuantity(e.target.value)}
                            className={`quantity-input ${newItemQuantityError ? 'input-error' : ''}`}
                            aria-label="Quantidade total do item"
                        />
                        <select
                            value={newItemUnit}
                            onChange={(e) => setNewItemUnit(e.target.value)}
                            className="unit-select"
                            aria-label="Unidade de medida do item"
                        >
                            <option value="unidade">Unidade</option>
                            <option value="grama">Grama</option>
                            <option value="quilo">Quilo</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Subcategoria (opcional)"
                            value={newItemSubcategory}
                            onChange={(e) => setNewItemSubcategory(e.target.value)}
                            className="subcategory-input"
                            aria-label="Subcategoria do item"
                            list="available-subcategories"
                        />
                        <datalist id="available-subcategories">
                            {availableSubcategories.map(sub => <option key={sub} value={sub} />)}
                        </datalist>

                        <select
                            value={newItemPriority}
                            onChange={(e) => setNewItemPriority(e.target.value)}
                            className="priority-select"
                            aria-label="Prioridade do novo item"
                        >
                            <option value="Alta">Alta Prioridade</option>
                            <option value="Média">Média Prioridade</option>
                            <option value="Baixa">Baixa Prioridade</option>
                        </select>
                        <button type="submit" className="add-button" aria-label="Adicionar Item à Lista">
                            + Adicionar Item
                        </button>
                        {(newItemNameError || newItemQuantityError) && (
                            <div className="input-error-message add-item-form-error">
                                {newItemNameError} {newItemQuantityError && newItemNameError ? ' | ' : ''} {newItemQuantityError}
                            </div>
                        )}
                    </form>

                    <div className="list-container">
                        {filteredAndSortedItems.length === 0 ? (
                            <p className="empty-list-message">
                                {searchQuery.trim() !== '' || selectedSubcategoryFilter !== '' ? 'Nenhum item encontrado com seus filtros.' : 'Sua lista de compras está vazia. Comece adicionando um item!'}
                            </p>
                        ) : (
                            filteredAndSortedItems.map((item) => (
                                <ShoppingItemCard
                                    key={item.id}
                                    item={item}
                                    onDeleteItem={handleDeleteItem}
                                    onUpdateItem={handleUpdateItem}
                                    onAddOrUpdateMarketPrice={handleAddOrUpdateMarketPrice}
                                    onDeleteMarketPrice={handleDeleteMarketPrice}
                                    isMarketMode={false}
                                />
                            ))
                        )}
                    </div>
                </>
            ) : ( // MODO MERCADO
                <div className="market-mode-view">
                    <form onSubmit={handleSetCurrentMarket} className="current-market-selection">
                        <input
                            type="text"
                            placeholder="Qual mercado você está visitando?"
                            value={currentMarketInput}
                            onChange={(e) => setCurrentMarketInput(e.target.value)}
                            className="current-market-input"
                            aria-label="Nome do mercado atual"
                        />
                        <button type="submit" className="set-market-button">
                            Selecionar Mercado
                        </button>
                         <button
                            type="button"
                            onClick={handleClearCurrentMarket}
                            className="clear-market-button"
                        >
                            Limpar Mercado
                        </button>
                    </form>

                    {currentMarketForShopping ? (
                        <div className="market-mode-info">
                            <p>Comprando em: <strong>{currentMarketForShopping}</strong></p>
                            <h2 className="market-mode-total">
                                Total do Carrinho: <span>R$ {calculateMarketModeTotal()}</span>
                            </h2>
                        </div>
                    ) : (
                        <p className="market-mode-instruction">
                         Por favor, digite e selecione o mercado que você está visitando para começar a comparar preços e somar o total.
                        </p>
                    )}

                    <div className="list-container market-mode-list-container">
                        {filteredAndSortedItems.length === 0 ? (
                            <p className="empty-list-message">
                                {searchQuery.trim() !== '' || selectedSubcategoryFilter !== '' ? 'Nenhum item encontrado com seus filtros.' : 'Sua lista de compras está vazia. Adicione itens no Modo Planejamento.'}
                            </p>
                        ) : (
                            filteredAndSortedItems.map((item) => (
                                <ShoppingItemCard
                                    key={item.id}
                                    item={item}
                                    onAddOrUpdateMarketPrice={handleAddOrUpdateMarketPrice}
                                    isMarketMode={true}
                                    currentMarketForShopping={currentMarketForShopping}
                                    onToggleInCart={handleToggleInCart}
                                    onDeleteItem={handleDeleteItem}
                                    onUpdateItem={handleUpdateItem} // Pass to update item's quantity for total calc
                                    onDeleteMarketPrice={handleDeleteMarketPrice}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;