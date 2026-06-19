import { AlertCircle, MapPin } from 'lucide-react';

export const PreparacaoEOutrasCidades = () => {
  return (
    <section className="py-12 md:py-16 bg-primary-beige">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-8">
        
        <div className="bg-primary-white p-10 rounded-2xl shadow-sm border border-border-gray flex flex-col gap-6">
          <div className="flex items-center gap-4 text-accent-copper">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-2xl font-medium font-serif text-primary-brown">
            Uma orientação importante antes da consulta
          </h2>
          <p className="text-secondary-green text-lg leading-relaxed">
            É necessário estar há pelo menos <strong>21 dias sem utilizar antibióticos</strong>, pois o uso recente pode interferir nos resultados, especialmente na flora bucal e nos gases avaliados.
          </p>
        </div>

        <div className="bg-primary-white p-10 rounded-2xl shadow-sm border border-border-gray flex flex-col gap-6">
          <div className="flex items-center gap-4 text-soft-green">
            <MapPin size={28} />
          </div>
          <h2 className="text-2xl font-medium font-serif text-primary-brown">
            Vem de outra cidade, estado ou país?
          </h2>
          <p className="text-secondary-green text-lg leading-relaxed">
            Informe sua origem durante o contato para que a equipe possa orientar a melhor organização da consulta. Vale lembrar que a consulta visa o diagnóstico, e não o tratamento imediato no mesmo dia.
          </p>
        </div>

      </div>
    </section>
  );
};
