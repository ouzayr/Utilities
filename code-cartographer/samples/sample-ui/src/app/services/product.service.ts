import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Product {
  id: number;
  sku: string;
  name: string;
  price: number;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/api/products`;

  list(): Observable<Product[]> {
    return this.http.get<Product[]>(this.base);
  }
  get(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.base}/${id}`);
  }
}
