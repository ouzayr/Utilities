import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Order } from '../models/order.model';
import { OrderService } from '../services/order.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2 *ngIf="order">{{ order.reference }}</h2>
    <p *ngIf="order">Status: {{ order.status }}</p>
    <button (click)="cancel()">Cancel</button>
  `,
})
export class OrderDetailComponent implements OnInit {
  private orderSvc = inject(OrderService);
  private route = inject(ActivatedRoute);
  order?: Order;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.orderSvc.get(id).subscribe((o) => (this.order = o));
  }

  cancel() {
    if (!this.order) return;
    this.orderSvc.updateStatus(this.order.id, { status: 'cancelled' }).subscribe((o) => (this.order = o));
  }
}
