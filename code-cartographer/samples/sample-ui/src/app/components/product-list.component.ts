import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Product, ProductService } from '../services/product.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2>Products</h2>
    <ul>
      <li *ngFor="let p of products">{{ p.sku }} — {{ p.name }}</li>
    </ul>
  `,
})
export class ProductListComponent implements OnInit {
  private products$ = inject(ProductService);
  products: Product[] = [];
  ngOnInit(): void {
    this.products$.list().subscribe((p) => (this.products = p));
  }
}
