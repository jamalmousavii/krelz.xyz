import { render, screen } from '@testing-library/react';
import Portal from '../components/Portal';

// v3.42.1 — fixed overlays escape the chat frame's transformed container.
describe('Portal', () => {
  it('renders children into document.body after mount (SSR-safe)', () => {
    const { container } = render(
      <div>
        <Portal>
          <div data-testid="overlay">menu</div>
        </Portal>
      </div>
    );
    const el = screen.getByTestId('overlay');
    // Not inside the rendering parent — portaled to <body> itself.
    expect(container.contains(el)).toBe(false);
    expect(document.body.contains(el)).toBe(true);
  });
});
