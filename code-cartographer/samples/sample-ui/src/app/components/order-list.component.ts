import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Order } from '../models/order.model';
import { OrderService } from '../services/order.service';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2>Orders</h2>
    <ul>
      <li *ngFor="let o of orders">{{ o.reference }} — {{ o.status }}</li>
    </ul>
  `,
  styleUrls: ['./order-list.component.scss'],
})
export class OrderListComponent implements OnInit {
  private orderSvc = inject(OrderService);
  orders: Order[] = [];

  ngOnInit(): void {
    this.orderSvc.list().subscribe((o) => (this.orders = o));
  }
}
