import { ShoppingBag } from "lucide-react";
import type { EcommerceData } from "../../core/types";
import { formatMoney } from "../../core/url";

export function EcommerceSection({ data }: { data: EcommerceData }) {
  if (data.items.length === 0 && data.value === undefined && data.transaction_id === undefined) {
    return null;
  }
  return (
    <section className="detail-section">
      <h3 className="section-title">Ecommerce</h3>

      {(data.value !== undefined || data.transaction_id !== undefined || data.currency) && (
        <div className="ecom-summary">
          {data.value !== undefined && (
            <div className="ecom-total">
              {formatMoney(data.value, data.currency)}
            </div>
          )}
          {data.transaction_id && (
            <div className="ecom-txid">
              Transaction <span className="value-mono">{data.transaction_id}</span>
            </div>
          )}
          {data.currency && (
            <div className="ecom-currency">Currency {data.currency}</div>
          )}
        </div>
      )}

      {data.items.length > 0 && (
        <div className="ecom-items">
          <div className="ecom-count">
            {data.items.length} item{data.items.length === 1 ? "" : "s"}
          </div>
          {data.items.map((item, i) => (
            <div className="ecom-item" key={i}>
              <span className="ecom-item-icon">
                <ShoppingBag size={12} />
              </span>
              <div className="ecom-item-main">
                <div className="ecom-item-name">
                  {item.item_name || item.item_id || "Item"}
                </div>
                <div className="ecom-item-sub">
                  {item.item_id && item.item_id !== item.item_name && (
                    <span className="value-mono">{item.item_id}</span>
                  )}
                  {item.quantity !== undefined && item.quantity !== 1 && (
                    <span>Qty {item.quantity}</span>
                  )}
                  {item.brand && <span>{item.brand}</span>}
                  {item.category && <span>{item.category}</span>}
                </div>
              </div>
              {typeof item.price === "number" && (
                <div className="ecom-item-price">
                  {formatMoney(item.price, item.currency ?? data.currency)}
                  {item.quantity !== undefined && item.quantity > 1 && (
                    <span className="ecom-item-total">
                      = {formatMoney(item.price * item.quantity, item.currency ?? data.currency)}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}